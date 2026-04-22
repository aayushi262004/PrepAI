import os
import json
import re
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PrepAI NLP Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = "llama3-70b-8192"

# Lazy client — only created on first request, not at startup
# This prevents a crash if GROQ_API_KEY is not set when the container boots
_groq_client = None

def get_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="GROQ_API_KEY is not set. Add it in HuggingFace Space Settings → Secrets."
            )
        from groq import Groq
        _groq_client = Groq(api_key=api_key)
    return _groq_client


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str

class ATSRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = ""

class SectionScores(BaseModel):
    skills_match: int
    experience_relevance: int
    education_fit: int
    keywords: int
    formatting: int

class ATSResponse(BaseModel):
    ats_score: int
    section_scores: SectionScores
    matched_keywords: List[str]
    missing_keywords: List[str]
    formatting_issues: List[str]
    strengths: List[str]
    recommendations: List[str]
    summary: str

class ResumeAnalysisResponse(BaseModel):
    match_score: int
    matched_skills: List[str]
    missing_skills: List[str]
    suggestions: List[str]
    summary_feedback: str
    experience_gap: str
    tone_feedback: str


# ─── Helper ───────────────────────────────────────────────────────────────────

def call_groq_json(system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> dict:
    client = get_client()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.1,
            max_tokens=max_tokens,
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        # Retry asking strictly for JSON
        messages.append({"role": "assistant", "content": raw})
        messages.append({"role": "user", "content": "Return ONLY the JSON object, no other text."})
        retry = client.chat.completions.create(
            model=MODEL, messages=messages, temperature=0.0, max_tokens=max_tokens,
        )
        raw2 = re.sub(r"```json|```", "", retry.choices[0].message.content.strip()).strip()
        return json.loads(raw2)


# ─── ATS Scoring ──────────────────────────────────────────────────────────────

@app.post("/ats", response_model=ATSResponse)
async def ats_score(req: ATSRequest):
    if len(req.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text too short")

    jd_section = f"\nJob Description:\n{req.job_description}" if req.job_description else "\n(No JD provided — score on general best practices)"

    system_prompt = """You are an expert ATS system and recruiter with 10+ years experience.
Respond with ONLY valid JSON, no explanation, no markdown.

Scoring rubric (total 100 points):
- skills_match (0-30): technical and soft skills match
- experience_relevance (0-25): relevance, recency, seniority level
- education_fit (0-15): education background fit
- keywords (0-20): ATS keywords from job description
- formatting (0-10): structure, action verbs, quantified achievements"""

    user_prompt = f"""Analyze this resume and return ONLY this JSON:

Resume:
{req.resume_text[:3000]}
{jd_section[:2000]}

{{
  "ats_score": <integer 0-100>,
  "section_scores": {{
    "skills_match": <0-30>,
    "experience_relevance": <0-25>,
    "education_fit": <0-15>,
    "keywords": <0-20>,
    "formatting": <0-10>
  }},
  "matched_keywords": ["keyword1", "keyword2"],
  "missing_keywords": ["keyword3", "keyword4"],
  "formatting_issues": ["issue1"],
  "strengths": ["strength1", "strength2"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "summary": "2-3 sentence overall assessment"
}}"""

    try:
        result = call_groq_json(system_prompt, user_prompt)
        ss = result.get("section_scores", {})
        section_scores = SectionScores(
            skills_match=max(0, min(30, int(ss.get("skills_match", 0)))),
            experience_relevance=max(0, min(25, int(ss.get("experience_relevance", 0)))),
            education_fit=max(0, min(15, int(ss.get("education_fit", 0)))),
            keywords=max(0, min(20, int(ss.get("keywords", 0)))),
            formatting=max(0, min(10, int(ss.get("formatting", 0)))),
        )
        computed_total = (section_scores.skills_match + section_scores.experience_relevance +
                         section_scores.education_fit + section_scores.keywords + section_scores.formatting)
        return ATSResponse(
            ats_score=computed_total,
            section_scores=section_scores,
            matched_keywords=result.get("matched_keywords", [])[:15],
            missing_keywords=result.get("missing_keywords", [])[:15],
            formatting_issues=result.get("formatting_issues", [])[:5],
            strengths=result.get("strengths", [])[:5],
            recommendations=result.get("recommendations", [])[:5],
            summary=result.get("summary", "Analysis complete."),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM scoring failed: {str(e)}")


# ─── Resume Analysis ──────────────────────────────────────────────────────────

@app.post("/analyze", response_model=ResumeAnalysisResponse)
async def analyze_resume(req: AnalyzeRequest):
    if len(req.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text too short")
    if len(req.job_description.strip()) < 20:
        raise HTTPException(status_code=400, detail="Job description too short")

    system_prompt = """You are a senior technical recruiter and career coach.
Compare resumes against job descriptions with expert precision.
Respond with ONLY valid JSON, no explanation, no markdown."""

    user_prompt = f"""Compare this resume against the job description and return ONLY this JSON:

Resume:
{req.resume_text[:3000]}

Job Description:
{req.job_description[:2000]}

{{
  "match_score": <integer 0-100>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3", "skill4"],
  "suggestions": ["actionable tip 1", "actionable tip 2", "actionable tip 3"],
  "summary_feedback": "2-3 sentences overall assessment",
  "experience_gap": "one sentence on experience level fit",
  "tone_feedback": "one sentence on resume language and impact"
}}"""

    try:
        result = call_groq_json(system_prompt, user_prompt)
        return ResumeAnalysisResponse(
            match_score=max(0, min(100, int(result.get("match_score", 50)))),
            matched_skills=result.get("matched_skills", [])[:20],
            missing_skills=result.get("missing_skills", [])[:20],
            suggestions=result.get("suggestions", [])[:6],
            summary_feedback=result.get("summary_feedback", ""),
            experience_gap=result.get("experience_gap", ""),
            tone_feedback=result.get("tone_feedback", ""),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM analysis failed: {str(e)}")


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    key = os.environ.get("GROQ_API_KEY")
    return {
        "status": "ok",
        "model": MODEL,
        "groq_configured": bool(key),
        "groq_key_preview": f"{key[:8]}..." if key else "NOT SET — add in HF Space Secrets",
    }