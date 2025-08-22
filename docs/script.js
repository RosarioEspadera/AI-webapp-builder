const generateBtn = document.getElementById("generateBtn");
const runBtn = document.getElementById("runBtn");
const promptInput = document.getElementById("prompt");
const terminal = document.getElementById("terminal");
const outputCode = document.querySelector("#output code");
const preview = document.getElementById("preview");
const tabs = document.querySelectorAll(".tab");

let files = {
  "index.html": "",
  "style.css": "",
  "script.js": ""
};
let activeFile = "index.html";

// --- Utility: Simulate typing to terminal ---
function typeToTerminal(text, delay = 30) {
  return new Promise(resolve => {
    let i = 0;
    function typeChar() {
      if (i < text.length) {
        terminal.textContent += text[i];
        terminal.scrollTop = terminal.scrollHeight;
        i++;
        setTimeout(typeChar, delay);
      } else {
        terminal.textContent += "\n";
        resolve();
      }
    }
    typeChar();
  });
}

// --- Update code editor with syntax highlighting ---
function updateOutput() {
  outputCode.textContent = files[activeFile] || "";
  
  if (activeFile.endsWith(".html")) {
    outputCode.className = "language-markup";
  } else if (activeFile.endsWith(".css")) {
    outputCode.className = "language-css";
  } else if (activeFile.endsWith(".js")) {
    outputCode.className = "language-javascript";
  }
  
  Prism.highlightElement(outputCode);
}

// --- Handle tab switching ---
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelector(".tab.active").classList.remove("active");
    tab.classList.add("active");
    activeFile = tab.dataset.file;
    updateOutput();
  });
});

// --- Generate files using backend ---
generateBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return alert("Please enter a prompt!");

  terminal.textContent = "";
  await typeToTerminal(`$ ai-builder generate "${prompt}"`);
  await typeToTerminal("Connecting to AI Web App Builder...");
  
  try {
    const response = await fetch("https://ai-webapp-builder-production.up.railway.app/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error("Server error");

    const data = await response.json();

    if (data.files) {
      files = data.files;
      updateOutput();
      await typeToTerminal("✔️ Files generated successfully!");
    } else {
      await typeToTerminal("⚠️ No files received from AI.");
    }
  } catch (err) {
    await typeToTerminal("❌ Error: " + err.message);
  }
});

// --- Run the generated app in preview ---
runBtn.addEventListener("click", async () => {
  terminal.textContent = "";
  await typeToTerminal(`$ ai-builder run app`);
  await typeToTerminal("Launching preview...");

  const html = files["index.html"] || "";
  const css = `<style>${files["style.css"] || ""}</style>`;
  const js = `<script>${files["script.js"] || ""}<\/script>`;

  const blob = new Blob([html.replace("</head>", css + "</head>").replace("</body>", js + "</body>")], { type: "text/html" });
  preview.src = URL.createObjectURL(blob);

  await typeToTerminal("✔️ App running in preview window.");
});
