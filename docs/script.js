document.getElementById("generateBtn").addEventListener("click", generate);

async function generate() {
  const prompt = document.getElementById("prompt").value;
  const output = document.getElementById("output");
  const preview = document.getElementById("preview");

  if (!prompt.trim()) {
    alert("⚠️ Please describe your app before generating!");
    return;
  }

  output.textContent = "⏳ Generating code...";
  preview.srcdoc = "";

  try {
    const res = await fetch("https://ai-webapp-builder-production.up.railway.app/generate", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(prompt)
    });

    const data = await res.json();

    if (data.code) {
      // Show raw code in "View Code"
      output.textContent = data.code;

      // Also load it in Preview tab
      preview.srcdoc = data.code;
    } else {
      output.textContent = "❌ Error: No code returned";
    }
  } catch (err) {
    output.textContent = "❌ Failed to connect to backend";
    console.error(err);
  }
}

function showTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));

  if (tab === "code") {
    document.getElementById("codeTab").classList.add("active");
    document.querySelector(".tab-button:nth-child(1)").classList.add("active");
  } else {
    document.getElementById("previewTab").classList.add("active");
    document.querySelector(".tab-button:nth-child(2)").classList.add("active");
  }
}
