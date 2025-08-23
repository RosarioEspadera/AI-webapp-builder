let files = {
  "index.html": "",
  "style.css": "",
  "script.js": ""
};
let currentFile = "index.html";

const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const preview = document.getElementById("preview");
const lineNumbers = document.getElementById("lineNumbers");

// --- Terminal ---
function typeToTerminal(text, delay = 20) {
  return new Promise(resolve => {
    let i = 0;
    let interval = setInterval(() => {
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

// --- Editor Functions ---
function showFile(fileName) {
  saveFileEdits();
  currentFile = fileName;

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.remove("active");
    if (tab.dataset.file === fileName) tab.classList.add("active");
  });

  output.className = "";
  if (fileName.endsWith(".html")) output.classList.add("language-html");
  if (fileName.endsWith(".css")) output.classList.add("language-css");
  if (fileName.endsWith(".js")) output.classList.add("language-javascript");

  output.textContent = files[fileName] || "";
  Prism.highlightElement(output);
  updateLineNumbers();
}

function saveFileEdits() {
  files[currentFile] = output.textContent;
}

function updateLineNumbers() {
  const lines = (output.textContent.match(/\n/g) || []).length + 1;
  lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
}

// --- Auto Indent + Tab Support ---
output.addEventListener("keydown", function(e) {
  // Enter auto-indent
  if (e.key === "Enter") {
    e.preventDefault();
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    const textBefore = output.textContent.slice(0, range.startOffset);
    const currentLine = textBefore.split("\n").pop();
    const indentMatch = currentLine.match(/^\s+/);
    const indent = indentMatch ? indentMatch[0] : "";

    document.execCommand("insertText", false, "\n" + indent);
    updateLineNumbers();
    Prism.highlightElement(output);
  }

  // Tab & Shift+Tab
  if (e.key === "Tab") {
    e.preventDefault();
    if (e.shiftKey) {
      // Unindent
      let sel = window.getSelection();
      let range = sel.getRangeAt(0);
      let beforeText = output.textContent.slice(0, range.startOffset);
      let lineStart = beforeText.lastIndexOf("\n") + 1;
      let lineText = beforeText.slice(lineStart);
      if (lineText.startsWith("  ")) {
        document.execCommand("delete", false, null);
        document.execCommand("delete", false, null);
      }
    } else {
      document.execCommand("insertText", false, "  ");
    }
    updateLineNumbers();
    Prism.highlightElement(output);
  }
});

// Update line numbers live
output.addEventListener("input", () => {
  updateLineNumbers();
  Prism.highlightElement(output);
});

// --- Preview Injection ---
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

// --- Tabs ---
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    showFile(tab.dataset.file);
  });
});

// --- Generate Example Files ---
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
h1 {
  color: purple;
}
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

  // Show full code in terminal
  await typeToTerminal("📄 index.html:\n" + files["index.html"]);
  await typeToTerminal("🎨 style.css:\n" + files["style.css"]);
  await typeToTerminal("⚙️ script.js:\n" + files["script.js"]);

  await typeToTerminal("✅ Build completed successfully!");
  showFile("index.html");
});

// --- Run App ---
document.getElementById("runBtn").addEventListener("click", () => {
  saveFileEdits();
  injectFilesIntoPreview(files);
  typeToTerminal("▶️ Running app in preview...");
});

// Initialize
showFile("index.html");
