const backendURL = "https://ai-webapp-builder-production.up.railway.app/generate";

let generatedFiles = {
  "index.html": "",
  "style.css": "",
  "script.js": ""
};

document.getElementById("generateBtn").addEventListener("click", generate);
document.getElementById("runBtn").addEventListener("click", runApp);

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const file = tab.dataset.file;
    document.getElementById("output").textContent = generatedFiles[file] || "";
  });
});

async function generate() {
  const prompt = document.getElementById("prompt").value;
  const output = document.getElementById("output");
  output.textContent = "⏳ Generating files...";

  try {
    const res = await fetch("https://ai-webapp-builder-production.up.railway.app/generate", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({prompt})
    });

    const data = await res.json();
    generatedFiles = data.files;

    // Show HTML by default
    document.getElementById("output").textContent = generatedFiles["index.html"] || "";
  } catch (err) {
    output.textContent = "❌ Error fetching from backend";
    console.error(err);
  }
}

function runApp() {
  const iframe = document.getElementById("preview");
  const html = `
<!DOCTYPE html>
<html>
<head>
<style>${generatedFiles["style.css"]}</style>
</head>
<body>
${generatedFiles["index.html"]}
<script>${generatedFiles["script.js"]}<\/script>
</body>
</html>`;
  iframe.srcdoc = html;
}
