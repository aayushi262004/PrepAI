"""
PrepAI NLP Service — LLM-powered ATS + Resume Analyzer
Deployed on HuggingFace Spaces (Docker SDK)

This replaces the old sentence-transformers approach.
Instead of dumb cosine similarity, we use Groq's LLaMA 3 to
read the resume like an expert recruiter and return structured scores.

Run locally:
    uvicorn app:app --reload --port 8001

On HuggingFace Spaces:
    The Dockerfile exposes port 7860 which HF maps automatically.
"""

import os
import json
import re
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

app = FastAPI(title="PrepAI NLP Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq client — key comes from HF Space secret or env var
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

MODEL = "llama3-70b-8192"  # Use 70b for better analysis quality


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str


class ATSRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = ""


class SectionScores(BaseModel):
    skills_match: int        # 0-30
    experience_relevance: int # 0-25
    education_fit: int        # 0-15
    keywords: int             # 0-20
    formatting: int           # 0-10


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


# ─── Helper: call Groq and parse JSON safely ──────────────────────────────────

def call_groq_json(system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> dict:
    """
    Call Groq API and parse the JSON response.
    Retries once with a stricter prompt if JSON parsing fails.
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.1,  # Low temp = consistent, structured output
            max_tokens=max_tokens,
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if present
        raw = re.sub(r"```json|```", "", raw).strip()

        return json.loads(raw)

    except json.JSONDecodeError:
        # Retry: explicitly ask for JSON only
        messages.append({"role": "assistant", "content": raw})
        messages.append({
            "role": "user",
            "content": "Your response was not valid JSON. Return ONLY the JSON object, no other text."
        })
        retry = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.0,
            max_tokens=max_tokens,
        )
        raw2 = retry.choices[0].message.content.strip()
        raw2 = re.sub(r"```json|```", "", raw2).strip()
        return json.loads(raw2)


# ─── ATS Scoring Endpoint ─────────────────────────────────────────────────────

@app.post("/ats", response_model=ATSResponse)
async def ats_score(req: ATSRequest):
    """
    LLM-powered ATS scoring.
    Scores resume across 5 dimensions like a real ATS + recruiter.
    """
    if len(req.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text too short")

    jd_section = f"\nJob Description:\n{req.job_description}" if req.job_description else "\n(No job description provided — score based on general best practices)"

    system_prompt = """You are an expert ATS (Applicant Tracking System) and recruiter with 10+ years of experience.
You analyze resumes with extreme precision. You MUST respond with ONLY valid JSON, no explanation, no markdown.

Scoring rubric (total 100 points):
- skills_match (0-30): How well do the candidate's technical and soft skills match the job requirements?
- experience_relevance (0-25): Is their experience relevant, recent, and at the right level?
- education_fit (0-15): Does their education background fit the role?
- keywords (0-20): Does the resume contain the right ATS keywords from the job description?
- formatting (0-10): Is the resume well-structured, ATS-readable, uses action verbs, quantified achievements?

Be strict but fair. A score above 80 means the candidate should be shortlisted."""

    user_prompt = f"""Analyze this resume against the job description and return a JSON object.

Resume:
{req.resume_text[:3000]}
{jd_section[:2000]}

Return ONLY this exact JSON structure (no other text):
{{
  "ats_score": <integer 0-100, sum of all section scores>,
  "section_scores": {{
    "skills_match": <0-30>,
    "experience_relevance": <0-25>,
    "education_fit": <0-15>,
    "keywords": <0-20>,
    "formatting": <0-10>
  }},
  "matched_keywords": ["keyword1", "keyword2"],
  "missing_keywords": ["keyword3", "keyword4"],
  "formatting_issues": ["issue1", "issue2"],
  "strengths": ["strength1", "strength2", "strength3"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "summary": "2-3 sentence overall assessment of this candidate"
}}"""

    try:
        result = call_groq_json(system_prompt, user_prompt)

        # Validate and clamp scores
        ss = result.get("section_scores", {})
        section_scores = SectionScores(
            skills_match=max(0, min(30, int(ss.get("skills_match", 0)))),
            experience_relevance=max(0, min(25, int(ss.get("experience_relevance", 0)))),
            education_fit=max(0, min(15, int(ss.get("education_fit", 0)))),
            keywords=max(0, min(20, int(ss.get("keywords", 0)))),
            formatting=max(0, min(10, int(ss.get("formatting", 0)))),
        )

        computed_total = (
            section_scores.skills_match +
            section_scores.experience_relevance +
            section_scores.education_fit +
            section_scores.keywords +
            section_scores.formatting
        )

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

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM scoring failed: {str(e)}")


# ─── Resume Analysis Endpoint ─────────────────────────────────────────────────

@app.post("/analyze", response_model=ResumeAnalysisResponse)
async def analyze_resume(req: AnalyzeRequest):
    """
    Deep resume vs JD analysis.
    Returns skill gaps, match score, and actionable improvement suggestions.
    """
    if len(req.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text too short")
    if len(req.job_description.strip()) < 20:
        raise HTTPException(status_code=400, detail="Job description too short")

    system_prompt = """You are a senior technical recruiter and career coach.
You compare resumes against job descriptions with expert precision.
You MUST respond with ONLY valid JSON, no explanation, no markdown fences."""

    user_prompt = f"""Compare this resume against the job description.

Resume:
{req.resume_text[:3000]}

Job Description:
{req.job_description[:2000]}

Return ONLY this JSON (no other text):
{{
  "match_score": <integer 0-100 representing how well the resume matches the JD>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3", "skill4"],
  "suggestions": [
    "Specific actionable improvement 1",
    "Specific actionable improvement 2",
    "Specific actionable improvement 3"
  ],
  "summary_feedback": "2-3 sentences overall assessment",
  "experience_gap": "One sentence on experience level fit or gap",
  "tone_feedback": "One sentence on resume tone, language and impact"
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM analysis failed: {str(e)}")


# ─── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL,
        "groq_configured": bool(os.environ.get("GROQ_API_KEY")),
    }
