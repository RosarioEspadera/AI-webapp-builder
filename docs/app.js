// ==========================
// Backend endpoint
// ==========================
const backendURL = "https://ai-webapp-builder-production.up.railway.app/generate"; 

// ==========================
// Elements
// ==========================
const logsEl = document.getElementById("logs");
const editorHost = document.getElementById("editor");
const previewFrame = document.getElementById("previewFrame");
const promptInput = document.getElementById("promptInput");
const generateBtn = document.getElementById("generateBtn");
const runBtn = document.getElementById("runBtn");
const resetBtn = document.getElementById("resetBtn");
const statusLeft = document.getElementById("statusLeft");
const autoRunEl = document.getElementById("autoRun");

// ==========================
// State & persistence
// ==========================
const STORAGE_KEY = "awb:files:v2";
const TAB_KEY = "awb:tab:v2";

let files = {
  "index.html": "<!-- Start typing or click ✨ Generate -->",
  "style.css": "/* styles */",
  "script.js": "// JS"
};
let currentFile = localStorage.getItem(TAB_KEY) || "index.html";

// Load from localStorage if present
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  files = { ...files, ...saved };
} catch { /* ignore */ }

function saveAll() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  localStorage.setItem(TAB_KEY, currentFile);
}

// ==========================
// Logger
// ==========================
function log(msg, cls) {
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.textContent = msg;
  logsEl.appendChild(div);
  logsEl.scrollTop = logsEl.scrollHeight;
}
function clearLogs() { logsEl.textContent = ""; }

// ==========================
// Monaco setup
// ==========================
let monacoEditor;
let models = {}; // filename -> model

function languageFor(file) {
  if (file.endsWith(".html")) return "html";
  if (file.endsWith(".css")) return "css";
  if (file.endsWith(".js")) return "javascript";
  return "plaintext";
}

function createModelIfNeeded(file) {
  if (models[file]) return models[file];
  const uri = monaco.Uri.parse(`inmemory:///${file}`);
  const model = monaco.editor.createModel(files[file] || "", languageFor(file), uri);
  models[file] = model;
  // mirror model → files + preview + lint
  model.onDidChangeContent(debounce(() => {
    files[file] = model.getValue();
    saveAll();
    validateAll();               // diagnostics
    if (autoRunEl.checked) renderPreview(); // live preview
    statusLeft.textContent = `Edited ${file} • ${new Date().toLocaleTimeString()}`;
  }, 200));
  return model;
}

// Simple completion providers (handy snippets)
function registerCompletions() {
  // HTML snippets
  monaco.languages.registerCompletionItemProvider("html", {
    provideCompletionItems: () => ({
      suggestions: [
        snippet("html:base", "Basic HTML5", "html",
`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>\${1:App}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
\${0}
<script src="script.js"></script>
</body>
</html>`),
        snippet("div.c", "<div class='container'>", "html", `<div class="container">\n\t\${0}\n</div>`),
        snippet("btn", "button.primary", "html", `<button class="btn">\${1:Click}</button>`)
      ]
    })
  });

  // CSS snippets
  monaco.languages.registerCompletionItemProvider("css", {
    provideCompletionItems: () => ({
      suggestions: [
        snippet("center-flex", "Center with flex", "css",
`.center {
  display: flex;
  align-items: center;
  justify-content: center;
}`),
        snippet("btn", ".btn style", "css",
`.btn {
  padding: .5rem .8rem;
  border-radius: .5rem;
  border: none;
  cursor: pointer;
}`)
      ]
    })
  });

  // JS snippets
  monaco.languages.registerCompletionItemProvider("javascript", {
    provideCompletionItems: () => ({
      suggestions: [
        snippet("qs", "document.querySelector", "javascript", `document.querySelector('\${1:#id}')`),
        snippet("listener", "addEventListener", "javascript",
`document.querySelector('\${1:#id}').addEventListener('\${2:click}', (e) => {
  \${0}
});`),
        snippet("fetch", "fetch JSON", "javascript",
`const res = await fetch('\${1:/api}');
const data = await res.json();
console.log(data);`)
      ]
    })
  });
}

function snippet(key, label, lang, body) {
  return {
    label, kind: monaco.languages.CompletionItemKind.Snippet,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    insertText: body, documentation: `${label} (${lang})`,
    range: undefined, // let Monaco decide
    sortText: "0",
    filterText: key
  };
}

// Basic validators for quick feedback in addition to Monaco’s own
function validateAll() {
  // HTML validate
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(files["index.html"] || "", "text/html");
    const errors = doc.querySelectorAll("parsererror");
    const markers = [];
    if (errors.length) {
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: "HTML parse warning: check structure (parser reported an issue).",
        startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2
      });
    }
    monaco.editor.setModelMarkers(models["index.html"] || createModelIfNeeded("index.html"), "html-check", markers);
  } catch {/* ignore */ }

  // CSS validate (very light)
  try {
    const styleSheet = new CSSStyleSheet();
    // will throw on some invalid rules in some browsers; wrap each rule
    const src = files["style.css"] || "";
    const markers = [];
    src.split("}").forEach((chunk, i) => {
      const rule = (chunk.trim() ? chunk + "}" : "").trim();
      if (!rule) return;
      try { styleSheet.insertRule(rule, styleSheet.cssRules.length); }
      catch {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: "CSS rule may be invalid near: " + rule.slice(0, 60),
          startLineNumber: i + 1, startColumn: 1, endLineNumber: i + 1, endColumn: 2
        });
      }
    });
    monaco.editor.setModelMarkers(models["style.css"] || createModelIfNeeded("style.css"), "css-check", markers);
  } catch {/* ignore */ }

  // JS syntax check (no execution)
  try {
    new Function(files["script.js"] || ""); // throws on syntax error
    monaco.editor.setModelMarkers(models["script.js"] || createModelIfNeeded("script.js"), "js-check", []);
  } catch (e) {
    monaco.editor.setModelMarkers(
      models["script.js"] || createModelIfNeeded("script.js"),
      "js-check",
      [{
        severity: monaco.MarkerSeverity.Error,
        message: String(e.message || e),
        startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1
      }]
    );
  }
}

function mountMonaco() {
  require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
  require(['vs/editor/editor.main'], () => {
    monacoEditor = monaco.editor.create(editorHost, {
      model: null, // we’ll attach per-tab models
      theme: "vs-dark",
      automaticLayout: true,
      fontLigatures: true,
      fontSize: 14,
      minimap: { enabled: true },
      tabSize: 2,
      insertSpaces: true,
      wordWrap: "off",
      scrollBeyondLastLine: false,
      renderWhitespace: "selection"
    });

    // create models
    ["index.html", "style.css", "script.js"].forEach(createModelIfNeeded);

    // completions/snippets
    registerCompletions();

    // open current tab
    switchTab(currentFile);

    // initial preview & diagnostics
    renderPreview();
    validateAll();
  });
}

// ==========================
// Tabs
// ==========================
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.file));
});

function switchTab(file) {
  currentFile = file;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.file === file));
  const model = createModelIfNeeded(file);
  monacoEditor.setModel(model);
  statusLeft.textContent = `Editing ${file}`;
  saveAll();
}

// ==========================
// Preview
// ==========================
function renderPreview() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${files["style.css"] || ""}</style>
</head>
<body>
${files["index.html"] || ""}
<script>${files["script.js"] || ""}<\/script>
</body>
</html>`;
  const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
}
document.getElementById("fullscreenBtn").addEventListener("click", () => {
  const iframe = document.getElementById("previewFrame");
  if (iframe.requestFullscreen) {
    iframe.requestFullscreen();
  } else if (iframe.webkitRequestFullscreen) { // Safari
    iframe.webkitRequestFullscreen();
  } else if (iframe.msRequestFullscreen) { // IE11
    iframe.msRequestFullscreen();
  }
});

// ==========================
// Debounce helper
// ==========================
function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ==========================
// Generate via NDJSON stream
// ==========================
generateBtn.addEventListener("click", async () => {
  clearLogs();
  log("🚀 Requesting build…");

  const prompt = (promptInput.value || "simple app").trim();

  let resp;
  try {
    resp = await fetch(backendURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
  } catch (e) {
    log(`❌ Network error: ${e.message}`, "log-error");
    return;
  }

  if (!resp.ok || !resp.body) {
    log(`❌ Backend error: ${resp.status}`, "log-error");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lines = buffer.split("\n");
    buffer = lines.pop() || ""; // keep possible partial

    for (const line of lines) {
      if (!line.trim()) continue;
      let evt;
      try { evt = JSON.parse(line); }
      catch { log("⚠️ Skipped non-JSON chunk"); continue; }

      if (evt.type === "log") {
        log(evt.message);
      } else if (evt.type === "file") {
        // update files + model
        if (evt.name in files) {
          files[evt.name] = evt.content || "";
          saveAll();
          const model = createModelIfNeeded(evt.name);
          model.setValue(files[evt.name]);
          if (currentFile === evt.name) {
            monacoEditor.setModel(model);
          }
          validateAll();
          if (autoRunEl.checked) renderPreview();
          log(`🧩 Updated ${evt.name}`, "log-ok");
        } else if (evt.hidden) {
          // ignore hidden debug files in UI
        }
      }
    }
  }

  // trailing chunk (rare)
  if (buffer.trim()) {
    try {
      const evt = JSON.parse(buffer);
      if (evt.type === "file" && evt.name in files) {
        files[evt.name] = evt.content || "";
      }
    } catch {}
  }

  log("✅ Build stream finished", "log-ok");
});

// ==========================
// Run & Reset
// ==========================
runBtn.addEventListener("click", () => {
  renderPreview();
  validateAll();
  log("▶️ Preview refreshed");
});

resetBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  files = {
    "index.html": "<!-- Start typing or click ✨ Generate -->",
    "style.css": "/* styles */",
    "script.js": "// JS"
  };
  Object.entries(models).forEach(([name, model]) => model.setValue(files[name]));
  renderPreview();
  validateAll();
  log("♻️ Workspace reset");
});

// ==========================
// Boot
// ==========================
mountMonaco();
