import os
import re
import json
import asyncio
import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

app = FastAPI()

# CORS (open for now, restrict later if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MODEL = os.getenv("GROQ_MODEL", "llama3-groq-70b-8192-tool-use-preview")

SYSTEM_PROMPT = """You are an AI web app code generator.
Return ONLY JSON with this shape:
{
  "index.html": "<!DOCTYPE html>...",
  "style.css": "/* css */",
  "script.js": "// js"
}
No prose, no markdown fences. Strict JSON only.
Keep code minimal, correct, and runnable in a browser.
"""

def extract_json_block(text: str):
    """Extract and sanitize the largest JSON object from Groq text output."""
    # Remove markdown fences if Groq added them
    cleaned = re.sub(r"```(?:json)?", "", text).strip()

    # Find all {...} spans
    matches = re.findall(r"\{[\s\S]*\}", cleaned)
    if not matches:
        return None

    # Pick the largest candidate
    candidate = max(matches, key=len)

    try:
        return json.loads(candidate)
    except Exception:
        # Attempt soft cleanup
        fixed = candidate.replace("\n", " ").replace("\t", " ")
        try:
            return json.loads(fixed)
        except Exception:
            return None

@app.get("/")
async def health():
    return JSONResponse({"ok": True, "model": MODEL})

@app.post("/generate")
async def generate(request: Request):
    body = await request.json()
    prompt = body.get("prompt", "").strip() or "simple app"

    async def stream():
        async def emit(obj):
            yield (json.dumps(obj) + "\n").encode("utf-8")

        # Start
        async for chunk in emit({"type": "log", "message": "🚀 Starting build process..."}):
            yield chunk
        await asyncio.sleep(0.2)

        async for chunk in emit({"type": "log", "message": "🧠 Calling Groq model..."}):
            yield chunk

        # Call Groq
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "temperature": 0.15,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f"Generate a web app: {prompt}"},
                    ],
                },
                timeout=60,
            )
        except Exception as e:
            async for chunk in emit({"type": "log", "message": f"❌ Network error: {e}"}):
                yield chunk
            return

        if resp.status_code != 200:
            async for chunk in emit({"type": "log", "message": f"❌ Groq HTTP {resp.status_code}: {resp.text[:300]}"}):
                yield chunk
            return

        # Parse response
        try:
            content = resp.json()["choices"][0]["message"]["content"]
        except Exception:
            async for chunk in emit({"type": "log", "message": "❌ Bad response format from Groq."}):
                yield chunk
            return

        # Debug log: raw output
        async for chunk in emit({"type": "log", "message": f"RAW OUTPUT (first 500 chars): {content[:500]}"}):
            yield chunk

        # 🔥 Send raw response as hidden file
        async for chunk in emit({"type": "file", "name": "_raw_groq.txt", "hidden": True, "content": content}):
            yield chunk

        # Try extracting JSON
        data = extract_json_block(content)
        if not isinstance(data, dict):
            async for chunk in emit({"type": "log", "message": "❌ Model did not return valid JSON."}):
                yield chunk
            # Ensure fallback empty files
            data = {"index.html": "", "style.css": "", "script.js": ""}

        # Ensure keys exist
        for name in ["index.html", "style.css", "script.js"]:
            if name not in data:
                data[name] = ""

        # Emit files
        async for chunk in emit({"type": "file", "name": "index.html", "content": data["index.html"]}):
            yield chunk
        await asyncio.sleep(0.1)

        async for chunk in emit({"type": "file", "name": "style.css", "content": data["style.css"]}):
            yield chunk
        await asyncio.sleep(0.1)

        async for chunk in emit({"type": "file", "name": "script.js", "content": data["script.js"]}):
            yield chunk

        # Done
        async for chunk in emit({"type": "log", "message": "✅ Build completed successfully!"}):
            yield chunk

    return StreamingResponse(stream(), media_type="application/x-ndjson; charset=utf-8")
