from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
import os
import re

app = FastAPI()

# Allow frontend (GitHub Pages)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL = "mixtral-8x7b-32768"  # cheap + good for code

SYSTEM_PROMPT = """
You are a code generator. 
Always respond with JSON only in the following format:

{
  "files": {
    "index.html": "...",
    "style.css": "...",
    "script.js": "..."
  }
}

Rules:
- Do NOT add explanations or text outside JSON.
- If a file is not needed, return an empty string.
- Code must be minimal and functional.
"""

def extract_json(text: str):
    """Safely extract JSON even if model adds extra text."""
    try:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return json.loads(match.group(0))
    except Exception:
        pass
    return {"files": {"index.html": "", "style.css": "", "script.js": ""}}

@app.post("/generate")
async def generate(request: Request):
    body = await request.json()
    prompt = body if isinstance(body, str) else body.get("prompt", "")

    response = requests.post(
        "https://api.groq.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Build a web app: {prompt}"}
            ],
            "temperature": 0
        }
    )

    raw_text = response.json()["choices"][0]["message"]["content"]
    data = extract_json(raw_text)
    return data
