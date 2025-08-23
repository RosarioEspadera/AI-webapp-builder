import os
import re
import json
import asyncio
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

app = FastAPI()

# CORS (open for dev, restrict later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Env config
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MODEL = os.getenv("GROQ_MODEL", "llama3-groq-70b-8192-tool-use-preview")

SYSTEM_PROMPT = """You are an AI web app code generator.
Return ONLY JSON with this shape:
{
  "index.html": "<!DOCTYPE html>...",
  "style.css": "/* css */",
  "script.js": "// js"
}
No prose, no markdown. Strict JSON only.
Keep code minimal, correct, and runnable in a browser.
"""

def extract_json_block(text: str):
    """Extract JSON object from accumulated stream."""
    try:
        match = re.search(r"\{[\s\S]*\}\s*$", text)
        if match:
            return json.loads(match.group(0))
    except Exception:
        return None
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

        # Logs
        async for chunk in emit({"type": "log", "message": "🚀 Starting build process..."}):
            yield chunk
        await asyncio.sleep(0.1)
        async for chunk in emit({"type": "log", "message": "🧠 Streaming from Groq..."}):
            yield chunk

        buffer = ""  # collects tokens
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": MODEL,
                        "temperature": 0.15,
                        "stream": True,  # ✅ enable Groq streaming
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": f"Generate a web app: {prompt}"},
                        ],
                    },
                ) as resp:
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        payload = line[len("data: "):].strip()
                        if payload == "[DONE]":
                            break
                        try:
                            delta = json.loads(payload)
                            token = delta["choices"][0]["delta"].get("content", "")
                            if token:
                                buffer += token
                        except Exception:
                            continue
        except Exception as e:
            async for chunk in emit({"type": "log", "message": f"❌ Stream error: {e}"}):
                yield chunk
            return

        # After stream ends → try parsing accumulated JSON
        data = extract_json_block(buffer)
        if not isinstance(data, dict):
            async for chunk in emit({"type": "log", "message": "❌ Could not parse valid JSON from stream."}):
                yield chunk
            return

        # Ensure keys exist
        for name in ["index.html", "style.css", "script.js"]:
            if name not in data:
                data[name] = ""

        # Stream files
        for name in ["index.html", "style.css", "script.js"]:
            async for chunk in emit({"type": "file", "name": name, "content": data[name]}):
                yield chunk
            await asyncio.sleep(0.05)

        # Done
        async for chunk in emit({"type": "log", "message": "✅ Build completed successfully!"}):
            yield chunk

    return StreamingResponse(stream(), media_type="application/x-ndjson; charset=utf-8")
