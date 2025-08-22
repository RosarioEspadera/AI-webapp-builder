const promptInput = document.getElementById("prompt");
const generateBtn = document.getElementById("generateBtn");
const runBtn = document.getElementById("runBtn");
const terminal = document.getElementById("terminal");
const tabs = document.querySelectorAll(".tab");
const output = document.getElementById("output");
const preview = document.getElementById("preview");

let files = { "index.html": "", "style.css": "", "script.js": "" };
let activeFile = "index.html";

// --- Fake Terminal Typing ---
function typeToTerminal(text) {
  let i = 0;
  function typing() {
    if (i < text.length) {
      terminal.textContent += text[i];
      terminal.scrollTop = terminal.scrollHeight;
      i++;
      setTimeout(typing, 20);
    } else {
      terminal.textContent += "\n";
    }
  }
  typing();
}

// --- Handle Tab Switching ---
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelector(".tab.active").classList.remove("active");
    tab.classList.add("active");
    activeFile = tab.dataset.file;
    output.textContent = files[activeFile] || "";
  });
});

// --- Generate Files ---
generateBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return alert("Please enter a prompt!");

  terminal.textContent = "";
  typeToTerminal(`> Generating app for: "${prompt}"\n`);

  try {
    const response = await fetch("https://ai-webapp-builder-production.up.railway.app/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    if (data.files) {
      files = data.files;
      output.textContent = files[activeFile];
      typeToTerminal("✔️ Files generated successfully!");
    } else {
      typeToTerminal("❌ Error: Failed to generate files.");
    }
  } catch (err) {
    typeToTerminal("❌ Network Error: " + err.message);
  }
});

// --- Run App in Preview ---
runBtn.addEventListener("click", () => {
  if (!files["index.html"]) {
    return typeToTerminal("❌ No app to run. Generate first.");
  }
  const blob = new Blob(
    [files["index.html"].replace("</body>", `<script>${files["script.js"]}</script></body>`)
      .replace("</head>", `<style>${files["style.css"]}</style></head>`)], 
    { type: "text/html" }
  );
  preview.src = URL.createObjectURL(blob);
  typeToTerminal("▶️ Running app in preview...");
});
