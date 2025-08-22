// === DOM ELEMENTS ===
const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const preview = document.getElementById("preview");
const promptInput = document.getElementById("prompt");
const generateBtn = document.getElementById("generateBtn");

const tabs = document.querySelectorAll(".tab");

let currentFile = "index.html";
let generatedFiles = {};

// === TYPING EFFECT IN TERMINAL ===
function typeInTerminal(text, callback) {
  let i = 0;
  terminal.innerHTML = ""; 
  const typing = setInterval(() => {
    terminal.innerHTML += text.charAt(i);
    i++;
    if (i >= text.length) {
      clearInterval(typing);
      if (callback) callback();
    }
  }, 30);
}

// === FILE TAB SWITCHING ===
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    currentFile = tab.dataset.file;
    showFileContent();
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

function showFileContent() {
  if (generatedFiles[currentFile]) {
    output.textContent = generatedFiles[currentFile];
  } else {
    output.textContent = `// ${currentFile} is empty`;
  }
}

// === FALLBACK CSS ===
const fallbackCSS = `
  body {
    font-family: Arial, sans-serif;
    background: #f4f4f9;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
  }
  h1 { color: #333; }
  input, button {
    padding: 10px;
    margin: 5px;
    border-radius: 5px;
    border: 1px solid #ccc;
  }
  button {
    background: #4CAF50;
    color: white;
    cursor: pointer;
  }
  button:hover { background: #45a049; }
  ul { list-style: none; padding: 0; }
  li {
    background: white;
    padding: 10px;
    margin: 5px 0;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
`;

// === PREVIEW INJECTION ===
function injectFilesIntoPreview(files) {
  const html = files["index.html"] || "<h1>No index.html found</h1>";
  const css = files["style.css"] && files["style.css"].trim() !== "" ? files["style.css"] : fallbackCSS;
  const js = files["script.js"] || "";

  const previewDoc = preview.contentDocument || preview.contentWindow.document;
  previewDoc.open();
  previewDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>${css}</style>
    </head>
    <body>
      ${html}
      <script>${js}<\/script>
    </body>
    </html>
  `);
  previewDoc.close();
}

// === GENERATE APP ===
generateBtn.addEventListener("click", async () => {
  const userPrompt = promptInput.value.trim();
  if (!userPrompt) return alert("Please enter a prompt!");

  typeInTerminal(`> Generating app for: "${userPrompt}"\n`, async () => {
    try {
      const res = await fetch("https://ai-webapp-builder-production.up.railway.app/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt })
      });

      const data = await res.json();
      generatedFiles = data.files || {};

      typeInTerminal(`> Generating app for: "${userPrompt}"\n✔ Files generated successfully!`, () => {
        showFileContent();
        injectFilesIntoPreview(generatedFiles);
      });

    } catch (err) {
      typeInTerminal("❌ Error generating files.");
      console.error(err);
    }
  });
});
