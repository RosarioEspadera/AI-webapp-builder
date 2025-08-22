from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os, re, json
import httpx

app = FastAPI()

# Allow frontend (GitHub Pages or any domain)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL = "mixtral-8x7b-32768"  # Groq model

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
    except Exception as e:
        print("⚠️ JSON extraction failed:", e)

    # Always return safe fallback
    return {"files": {"index.html": "", "style.css": "", "script.js": ""}}

@app.post("/generate")
async def generate(request: Request):
    body = await request.json()
    prompt = body.get("prompt", "") if isinstance(body, dict) else str(body)

    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
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
            response.raise_for_status()
            data = response.json()

        # Extract raw model output (before parsing)
        raw_text = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        print("📜 RAW MODEL OUTPUT:\n", raw_text, "\n--- END RAW ---")  # 🔥 Debug log

        return extract_json(raw_text)

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Groq API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
