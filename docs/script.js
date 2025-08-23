let files = {
  "index.html": "",
  "style.css": "",
  "script.js": ""
};
let currentFile = "index.html";

const STORAGE_KEY = "ai-webapp-builder:files:v1";
const CURRENT_FILE_KEY = "ai-webapp-builder:currentFile:v1";

const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const preview = document.getElementById("preview");
const lineNumbers = document.getElementById("lineNumbers");

/* ---------------- LocalStorage utils ---------------- */
function safeGetItem(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}
function saveFilesToStorage() {
  safeSetItem(STORAGE_KEY, JSON.stringify(files));
  safeSetItem(CURRENT_FILE_KEY, currentFile);
}
let saveDebounce;
function saveFilesToStorageDebounced() {
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(saveFilesToStorage, 200);
}
function loadFilesFromStorage() {
  const raw = safeGetItem(STORAGE_KEY);
  const cf = safeGetItem(CURRENT_FILE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") files = { ...files, ...parsed };
    } catch {}
  }
  if (cf && files[cf] !== undefined) currentFile = cf;
}

/* ---------------- Terminal ---------------- */
function typeToTerminal(text, delay = 20) {
  return new Promise(resolve => {
    let i = 0;
    const interval = setInterval(() => {
      terminal.textContent += text[i];
      terminal.scrollTop = terminal.scrollHeight;
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        terminal.textContent += "\n";
        resolve();
      }
    }, delay);
  });
}

/* ---------------- Editor ---------------- */
function showFile(fileName) {
  saveFileEdits(); // persist outgoing tab edits
  currentFile = fileName;

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.file === fileName);
  });

  // set syntax highlighting class
  output.className = "";
  if (fileName.endsWith(".html")) output.classList.add("language-html");
  if (fileName.endsWith(".css")) output.classList.add("language-css");
  if (fileName.endsWith(".js")) output.classList.add("language-javascript");

  output.textContent = files[fileName] || "";
  Prism.highlightElement(output);
  updateLineNumbers();
  saveFilesToStorageDebounced(); // persist currentFile
}

function saveFileEdits() {
  files[currentFile] = output.textContent;
  saveFilesToStorageDebounced();
}

function updateLineNumbers() {
  const lines = (output.textContent.match(/\n/g) || []).length + 1;
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
}

/* --- Auto Indent + Tab/Shift+Tab --- */
output.addEventListener("keydown", function(e) {
  // Enter -> auto indent
  if (e.key === "Enter") {
    e.preventDefault();
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    const textBefore = output.textContent.slice(0, range.startOffset);
    const currentLine = textBefore.split("\n").pop();
    const indent = (currentLine.match(/^\s+/) || [""])[0];
    document.execCommand("insertText", false, "\n" + indent);
    updateLineNumbers();
    Prism.highlightElement(output);
    saveFilesToStorageDebounced();
  }

  // Tab / Shift+Tab
  if (e.key === "Tab") {
    e.preventDefault();
    if (e.shiftKey) {
      // unindent if line starts with 2 spaces
      const sel = window.getSelection();
      const range = sel.getRangeAt(0);
      const before = output.textContent.slice(0, range.startOffset);
      const lineStart = before.lastIndexOf("\n") + 1;
      const lineText = before.slice(lineStart);
      if (lineText.startsWith("  ")) {
        document.execCommand("delete", false, null);
        document.execCommand("delete", false, null);
      }
    } else {
      document.execCommand("insertText", false, "  ");
    }
    updateLineNumbers();
    Prism.highlightElement(output);
    saveFilesToStorageDebounced();
  }
});

/* Live updates -> save + re-highlight */
output.addEventListener("input", () => {
  saveFileEdits();
  Prism.highlightElement(output);
});

/* ---------------- Preview ---------------- */
function injectFilesIntoPreview(files) {
  const doc = preview.contentDocument || preview.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>${files["style.css"] || ""}</style>
      </head>
      <body>
        ${files["index.html"] || ""}
        <script>${files["script.js"] || ""}<\/script>
      </body>
    </html>
  `);
  doc.close();
}

/* ---------------- Tabs ---------------- */
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showFile(tab.dataset.file));
});

/* ---------------- Generate Example Files ---------------- */
document.getElementById("generateBtn").addEventListener("click", async () => {
  terminal.textContent = "";
  await typeToTerminal("🚀 Starting build process...");
  await typeToTerminal("📦 Generating files...");

  files["index.html"] = `
<!DOCTYPE html>
<html>
<head>
  <title>Todo App</title>
</head>
<body>
  <h1>Todo List</h1>
  <input type="text" id="new-todo" placeholder="Add a new todo">
  <button id="add-todo">Add</button>
  <ul id="todo-list"></ul>
</body>
</html>
  `.trim();

  files["style.css"] = `
body {
  font-family: Arial, sans-serif;
  background: #f9f9f9;
  padding: 20px;
}
h1 { color: purple; }
  `.trim();

  files["script.js"] = `
const todoList = document.getElementById("todo-list");
const input = document.getElementById("new-todo");
const button = document.getElementById("add-todo");

button.addEventListener("click", () => {
  const text = input.value.trim();
  if (text !== "") {
    const li = document.createElement("li");
    li.textContent = text;
    todoList.appendChild(li);
    input.value = "";
  }
});
  `.trim();

  await typeToTerminal("📄 index.html:\n" + files["index.html"]);
  await typeToTerminal("🎨 style.css:\n" + files["style.css"]);
  await typeToTerminal("⚙️ script.js:\n" + files["script.js"]);
  await typeToTerminal("✅ Build completed successfully!");

  saveFilesToStorage();   // persist freshly generated files immediately
  showFile("index.html");
});

/* ---------------- Run ---------------- */
document.getElementById("runBtn").addEventListener("click", () => {
  saveFileEdits();
  injectFilesIntoPreview(files);
  typeToTerminal("▶️ Running app in preview...");
});

/* ---------------- Init ---------------- */
loadFilesFromStorage();
showFile(currentFile);
