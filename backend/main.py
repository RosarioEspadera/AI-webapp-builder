from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import os

app = FastAPI()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/generate")
async def generate_app(prompt: str = Body(...)):
    resp = client.chat.completions.create(
        model="llama3-70b-8192",
        messages=[
            {"role": "system", "content": "You are an AI that generates complete web apps in HTML, CSS, and JS."},
            {"role": "user", "content": prompt}
        ]
    )
    return {"code": resp.choices[0].message.content}
