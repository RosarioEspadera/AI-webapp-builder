from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import json, os

app = FastAPI()
client = OpenAI(api_key=os.getenv("GROQ_API_KEY"), base_url="https://api.groq.com/openai/v1")

# Enable CORS for frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = "llama3-groq-70b-8192-tool-use-preview"

@app.post("/generate")
async def generate_app(payload: dict):
    prompt = payload.get("prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required.")

    system_prompt = """You are an AI web app code generator.
You ONLY return JSON with three fields:
{
  "index.html": "<!DOCTYPE html>....",
  "style.css": "body {...}",
  "script.js": "console.log('hi')"
}
Do not explain. Do not add comments outside JSON. Keep it valid JSON.
"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            temperature=0.2,  # lower → more deterministic
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Generate a web app: {prompt}"}
            ]
        )

        raw = response.choices[0].message.content.strip()

        # Validate JSON (in case model outputs extra)
        try:
            files = json.loads(raw)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid JSON returned from model")

        return files

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
