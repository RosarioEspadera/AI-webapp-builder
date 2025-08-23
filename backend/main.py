import os
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

# Environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3-32b")

SYSTEM_PROMPT = """You are an AI web app code generator.

Your ONLY task:
- Return a single valid JSON object.
- No prose, no explanations, no markdown fences.

The JSON MUST have exactly these keys:
{
  "index.html": "<!DOCTYPE html>...",
  "style.css": "/* CSS here */",
  "script.js": "// JS here"
}

Rules:
- Never add extra keys.
- Never add comments outside the JSON.
- Code must be minimal, correct, runnable in browser.
"""

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

        async for chunk in emit({"type": "log", "message": f"🧠 Calling Groq model: {MODEL}"}):
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
                    "temperature": 0,  # deterministic output
                    "response_format": {"type": "json_object"},  # force JSON output
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
            async for chunk in emit({
                "type": "log",
                "message": f"❌ Groq HTTP {resp.status_code}: {resp.text[:300]}"
            }):
                yield chunk
            return

        # Parse JSON response
        try:
            content = resp.json()["choices"][0]["message"]["content"]
        except Exception:
            async for chunk in emit({"type": "log", "message": "❌ Bad response format from Groq."}):
                yield chunk
            return

        # Debug log: raw output
        async for chunk in emit({"type": "file", "name": "_raw_groq.txt", "hidden": True, "content": content}):
            yield chunk

        # Try JSON load
        try:
            data = json.loads(content)
        except Exception as e:
            async for chunk in emit({"type": "log", "message": f"❌ JSON parse error: {e}"}):
                yield chunk
            data = {"index.html": "", "style.css": "", "script.js": ""}

        # Ensure keys exist
        for name in ["index.html", "style.css", "script.js"]:
            if name not in data:
                data[name] = ""

        # Emit files
        for name in ["index.html", "style.css", "script.js"]:
            async for chunk in emit({"type": "file", "name": name, "content": data[name]}):
                yield chunk
            await asyncio.sleep(0.1)

        # Done
        async for chunk in emit({"type": "log", "message": "✅ Build completed successfully!"}):
            yield chunk

    return StreamingResponse(stream(), media_type="application/x-ndjson; charset=utf-8")
