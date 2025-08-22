document.addEventListener("DOMContentLoaded", () => {
  const generateBtn = document.getElementById("generateBtn");
  const promptInput = document.getElementById("prompt");
  const terminal = document.getElementById("terminal");
  const output = document.getElementById("output");
  const preview = document.getElementById("preview");
  const tabs = document.querySelectorAll(".tab");

  let files = {
    "index.html": "",
    "style.css": "",
    "script.js": ""
  };

  // --- Typing effect (per character) ---
  function typeWriter(message, delay = 20) {
    return new Promise(resolve => {
      let i = 0;
      function typeChar() {
        if (i < message.length) {
          terminal.textContent += message[i];
          terminal.scrollTop = terminal.scrollHeight;
          i++;
          setTimeout(typeChar, delay);
        } else {
          terminal.textContent += "\n";
          terminal.scrollTop = terminal.scrollHeight;
          resolve();
        }
      }
      typeChar();
    });
  }

  async function logFile(fileName, content) {
    await typeWriter(`\n📄 Writing ${fileName}...`);
    const lines = content.split("\n");
    for (const line of lines) {
      await typeWriter("  " + line);
    }
  }

  function injectFilesIntoPreview() {
    const doc = preview.contentDocument || preview.contentWindow.document;
    doc.open();
    doc.write(files["index.html"]);
    doc.close();

    // Append CSS
    const style = doc.createElement("style");
    style.textContent = files["style.css"];
    doc.head.appendChild(style);

    // Append JS
    const script = doc.createElement("script");
    script.textContent = files["script.js"];
    doc.body.appendChild(script);
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const fileName = tab.dataset.file;
      output.textContent = files[fileName] || "";
    });
  });

  generateBtn.addEventListener("click", async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      alert("Please enter an idea first.");
      return;
    }

    terminal.textContent = ""; // clear terminal
    await typeWriter(`$ Generating app for: "${prompt}" ...`);

    try {
      const response = await fetch("https://ai-webapp-builder-production.up.railway.app/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) throw new Error("Backend error");

      const data = await response.json();
      files = data.files || files;

      // --- Print each file line by line ---
      for (const [fileName, content] of Object.entries(files)) {
        await logFile(fileName, content);
      }

      await typeWriter("✔️ Build complete!");

      // Show index.html by default
      document.querySelector(".tab.active").click();

      // Update preview
      injectFilesIntoPreview();

    } catch (err) {
      console.error(err);
      await typeWriter("❌ Error generating files.");
    }
  });
});
