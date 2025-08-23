import os
import json
import asyncio
import httpx
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
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

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
        def emit(obj):
            return (json.dumps(obj) + "\n").encode("utf-8")

        # Start
        yield emit({"type": "log", "message": "🚀 Starting build process..."})
        await asyncio.sleep(0.2)

        yield emit({"type": "log", "message": f"🧠 Calling Groq model: {MODEL}"})

        # Call Groq
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": MODEL,
                        "temperature": 0,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": f"Generate a web app: {prompt}"},
                        ],
                    },
                )
        except Exception as e:
            yield emit({"type": "log", "message": f"❌ Network error: {e}"})
            return

        if resp.status_code != 200:
            yield emit({
                "type": "log",
                "message": f"❌ Groq HTTP {resp.status_code}: {resp.text[:300]}"
            })
            return

        # Parse JSON response
        try:
            content = resp.json()["choices"][0]["message"]["content"]
        except Exception:
            yield emit({"type": "log", "message": "❌ Bad response format from Groq."})
            return

        # Debug: save raw
        yield emit({"type": "file", "name": "_raw_groq.txt", "hidden": True, "content": content})

        # Try JSON load
        try:
            data = json.loads(content)
        except Exception as e:
            yield emit({"type": "log", "message": f"❌ JSON parse error: {e}"})
            data = {"index.html": "", "style.css": "", "script.js": ""}

        # Ensure keys exist
        for name in ["index.html", "style.css", "script.js"]:
            if name not in data:
                data[name] = ""

        # Emit files
        for name in ["index.html", "style.css", "script.js"]:
            yield emit({"type": "file", "name": name, "content": data[name]})
            await asyncio.sleep(0.1)

        # Done
        yield emit({"type": "log", "message": "✅ Build completed successfully!"})

    return StreamingResponse(stream(), media_type="application/x-ndjson; charset=utf-8")
