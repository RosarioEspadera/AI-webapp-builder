// ==========================
// 🔧 Config
// ==========================
const backendURL = "https://ai-webapp-builder-production.up.railway.app/generate";

// ==========================
// 📂 State
// ==========================
let files = {
  "index.html": "",
  "style.css": "",
  "script.js": ""
};
let currentFile = "index.html";

// ==========================
// 💾 Storage Keys
// ==========================
const STORAGE_KEY = "ai-webapp-builder:files:v1";
const CURRENT_FILE_KEY = "ai-webapp-builder:currentFile:v1";

// ==========================
// 🎨 Elements
// ==========================
const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const preview = document.getElementById("preview");
const lineNumbers = document.getElementById("lineNumbers");
const promptEl = document.getElementById("prompt");

// ==========================
// 💾 Persistence
// ==========================
function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}
function saveAll() {
  safeSet(STORAGE_KEY, JSON.stringify(files));
  safeSet(CURRENT_FILE_KEY, currentFile);
}
function loadAll() {
  const raw = safeGet(STORAGE_KEY);
  const cf = safeGet(CURRENT_FILE_KEY);
  if (raw) {
    try { files = { ...files, ...JSON.parse(raw) }; } catch {}
  }
  if (cf && files[cf] !== undefined) currentFile = cf;
}

// ==========================
// 🖥 Terminal Logger
// ==========================
function writeLog(msg, isError = false) {
  const line = document.createElement("div");
  line.textContent = msg;
  if (isError) line.style.color = "#f55";
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

// ==========================
// 🖱 Cursor Preservation
// ==========================
function getCursorPosition(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function setCursorPosition(el, pos) {
  const sel = window.getSelection();
  const range = document.createRange();
  let charIndex = 0;

  function findNode(node) {
    if (node.nodeType === 3) {
      let nextCharIndex = charIndex + node.length;
      if (pos >= charIndex && pos <= nextCharIndex) {
        range.setStart(node, pos - charIndex);
        range.setEnd(node, pos - charIndex);
        return true;
      }
      charIndex = nextCharIndex;
    } else {
      for (let child of node.childNodes) {
        if (findNode(child)) return true;
      }
    }
    return false;
  }

  findNode(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ==========================
// 📄 Editor
// ==========================
function showFile(fileName) {
  saveEdits();
  currentFile = fileName;

  // Highlight active tab
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.file === fileName);
  });

  // Syntax highlighting
  output.className = "editor";
  if (fileName.endsWith(".html")) output.classList.add("language-html");
  if (fileName.endsWith(".css")) output.classList.add("language-css");
  if (fileName.endsWith(".js")) output.classList.add("language-javascript");

  output.textContent = files[fileName] || "";
  Prism.highlightElement(output);
  updateLineNumbers();
  saveAll();
}

function saveEdits() {
  files[currentFile] = output.textContent;
  saveAll();
}

function updateLineNumbers() {
  const lines = (output.textContent.match(/\n/g) || []).length + 1;
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
}

// ==========================
// ⌨️ Input Handling
// ==========================
output.addEventListener("input", () => {
  const pos = getCursorPosition(output);
  Prism.highlightElement(output);
  setCursorPosition(output, pos);
  updateLineNumbers();
  saveEdits();
});

output.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    const before = output.textContent.slice(0, range.startOffset);
    const currentLine = before.split("\n").pop();
    const indent = (currentLine.match(/^\s+/) || [""])[0];
    document.execCommand("insertText", false, "\n" + indent);
    updateLineNumbers();
  } else if (e.key === "Tab") {
    e.preventDefault();
    document.execCommand("insertText", false, e.shiftKey ? "" : "  ");
    updateLineNumbers();
  }
});

// ==========================
// 🔍 Live Preview
// ==========================
function injectPreview() {
  const doc = preview.contentDocument || preview.contentWindow.document;
  doc.open();
  doc.write(`
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>${files["style.css"] || ""}</style>
</head>
<body>
${files["index.html"] || ""}
<script>${files["script.js"] || ""}<\/script>
</body>
</html>`);
  doc.close();
}

// ==========================
// 🗂 Tabs
// ==========================
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showFile(tab.dataset.file));
});

// ==========================
// 🤖 AI Code Generator
// ==========================
document.getElementById("generateBtn").addEventListener("click", async () => {
  terminal.textContent = "";
  writeLog("🚀 Requesting build...");

  const prompt = (promptEl.value || "simple todo app").trim();

  try {
    const res = await fetch(backendURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!res.ok || !res.body) {
      writeLog(`❌ Backend error: ${res.status}`, true);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch {
          writeLog("⚠️ Non-JSON chunk skipped");
          continue;
        }

        if (msg.type === "log") {
          writeLog(msg.message);
        } else if (msg.type === "file") {
          files[msg.name] = msg.content || "";
          saveAll();
          if (currentFile === msg.name) {
            output.textContent = files[msg.name];
            Prism.highlightElement(output);
            updateLineNumbers();
          }
          injectPreview();
          writeLog(`🧩 Updated ${msg.name}`);
        }
      }
    }

    // Handle final buffer
    if (buffer.trim()) {
      try {
        const msg = JSON.parse(buffer);
        if (msg.type === "log") writeLog(msg.message);
        if (msg.type === "file") {
          files[msg.name] = msg.content || "";
          injectPreview();
          writeLog(`🧩 Updated ${msg.name}`);
        }
      } catch {}
    }

    writeLog("✅ Build stream finished.");
  } catch (err) {
    writeLog(`❌ ${err.message}`, true);
  }
});

// ==========================
// ▶️ Run
// ==========================
document.getElementById("runBtn").addEventListener("click", () => {
  saveEdits();
  injectPreview();
  writeLog("▶️ Running app in preview...");
});

// ==========================
// ♻️ Reset
// ==========================
document.getElementById("resetBtn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CURRENT_FILE_KEY);
  files = { "index.html": "", "style.css": "", "script.js": "" };
  currentFile = "index.html";
  output.textContent = "";
  updateLineNumbers();
  Prism.highlightElement(output);
  injectPreview();
  writeLog("♻️ Workspace reset.");
});

// ==========================
// 🚀 Init
// ==========================
loadAll();
showFile(currentFile);
injectPreview();
