import os
import re
import json
import asyncio
import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

SYSTEM_PROMPT = """You are an AI web app code generator.
Return ONLY JSON with this shape:
{
  "index.html": "<!DOCTYPE html>...",
  "style.css": "/* css */",
  "script.js": "// js"
}
No prose, no markdown fences. Strict JSON only.
"""

def extract_json_block(text: str):
    """Extract JSON object safely from response text"""
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    matches = re.findall(r"\{[\s\S]*\}", cleaned)
    if not matches:
        return None
    candidate = max(matches, key=len)
    try:
        return json.loads(candidate)
    except Exception:
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

        # Start logs
        async for chunk in emit({"type": "log", "message": "🚀 Starting build process..."}): yield chunk
        await asyncio.sleep(0.2)
        async for chunk in emit({"type": "log", "message": f"🧠 Calling Groq model: {MODEL}"}): yield chunk

        # Call Groq API
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
            async for chunk in emit({"type": "log", "message": f"❌ Network error: {e}"}): yield chunk
            return

        if resp.status_code != 200:
            async for chunk in emit({"type": "log", "message": f"❌ Groq HTTP {resp.status_code}: {resp.text[:200]}"}): yield chunk
            return

        try:
            content = resp.json()["choices"][0]["message"]["content"]
        except Exception:
            async for chunk in emit({"type": "log", "message": "❌ Bad response format"}): yield chunk
            return

        # Send raw response (debug)
        async for chunk in emit({"type": "file", "name": "_raw_groq.txt", "hidden": True, "content": content}): yield chunk

        # Try parsing JSON
        data = extract_json_block(content) or {}
        for name in ["index.html", "style.css", "script.js"]:
            data.setdefault(name, "")

        # Send files once (frontend should keep edits after this!)
        for name in ["index.html", "style.css", "script.js"]:
            async for chunk in emit({"type": "file", "name": name, "content": data[name]}):
                yield chunk
            await asyncio.sleep(0.1)

        async for chunk in emit({"type": "log", "message": "✅ Build completed successfully!"}): yield chunk

    return StreamingResponse(stream(), media_type="application/x-ndjson; charset=utf-8")
