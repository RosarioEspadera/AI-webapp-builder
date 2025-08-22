document.getElementById("generateBtn").addEventListener("click", generate);

async function generate() {
  const prompt = document.getElementById("prompt").value;
  const preview = document.getElementById("preview");

  if (!prompt.trim()) {
    alert("⚠️ Please describe your app before generating!");
    return;
  }

  preview.srcdoc = "<p style='font-family:Arial; padding:20px;'>⏳ Generating app...</p>";

  try {
    const res = await fetch("https://ai-webapp-builder-production.up.railway.app/generate", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(prompt)
    });

    const data = await res.json();

    if (data.code) {
      preview.srcdoc = data.code;
    } else {
      preview.srcdoc = "<p style='color:red; font-family:Arial; padding:20px;'>❌ Error: No code returned</p>";
    }
  } catch (err) {
    preview.srcdoc = "<p style='color:red; font-family:Arial; padding:20px;'>❌ Failed to connect to backend</p>";
    console.error(err);
  }
}
