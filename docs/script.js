const backendURL = "https://ai-webapp-builder-production.up.railway.app/generate";

let generatedFiles = {
  "index.html": "",
  "style.css": "",
  "script.js": ""
};

// Elements
const output = document.getElementById("output");
const promptInput = document.getElementById("prompt");
const iframe = document.getElementById("preview");

// Button actions
document.getElementById("generateBtn").addEventListener("click", generate);
document.getElementById("runBtn").addEventListener("click", runApp);

// Tab switching
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const file = tab.dataset.file;
    const content = generatedFiles[file] || "// No code generated yet";
    output.textContent = content;
  });
});

async function generate() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    output.textContent = "⚠️ Please enter a prompt first.";
    return;
  }

  output.textContent = "⏳ Generating files... please wait";

  try {
    const res = await fetch(backendURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!res.ok) {
      const errMsg = `❌ Backend returned ${res.status} ${res.statusText}`;
      console.error(errMsg);
      output.textContent = errMsg;
      return;
    }

    const data = await res.json();

    // Ensure correct structure
    generatedFiles = data.files || {
      "index.html": "",
      "style.css": "",
      "script.js": ""
    };

    // Show HTML by default
    output.textContent = generatedFiles["index.html"] || "// Empty index.html";
  } catch (err) {
    console.error("❌ Backend error:", err);
    output.textContent = `❌ Failed to fetch from backend: ${err.message}`;
  }
}

function runApp() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${generatedFiles["style.css"] || ""}</style>
</head>
<body>
  ${generatedFiles["index.html"] || ""}
  <script>${generatedFiles["script.js"] || ""}<\/script>
</body>
</html>
  `;
  iframe.srcdoc = html;
}
