"""
PrepAI NLP Microservice
Uses sentence-transformers for semantic similarity between resume and job description
Run: uvicorn main:app --reload --port 8001
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import re
import json

app = FastAPI(title="PrepAI NLP Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load models lazily ───────────────────────────────────────────────────────
_model = None

def get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
            print("✅ SentenceTransformer model loaded")
        except ImportError:
            print("⚠️  sentence-transformers not installed, using fallback")
            _model = None
    return _model


# ─── Schemas ──────────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str


class AnalyzeResponse(BaseModel):
    match_score: int
    matched_skills: List[str]
    missing_skills: List[str]
    suggestions: List[str]
    summary_feedback: str


# ─── Skill extraction ─────────────────────────────────────────────────────────
TECH_SKILLS = [
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby",
    "react", "vue", "angular", "next.js", "node.js", "express", "django", "flask",
    "fastapi", "spring", "laravel", "rails",
    "sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch", "cassandra",
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform", "ansible",
    "git", "ci/cd", "jenkins", "github actions", "gitlab",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "scikit-learn",
    "rest api", "graphql", "microservices", "kafka", "rabbitmq",
    "html", "css", "tailwind", "sass", "webpack", "vite",
    "agile", "scrum", "jira", "linux", "bash", "data structures", "algorithms",
]

SOFT_SKILLS = [
    "communication", "leadership", "teamwork", "problem solving", "collaboration",
    "project management", "mentoring", "critical thinking", "adaptability",
]


def extract_skills(text: str) -> List[str]:
    text_lower = text.lower()
    found = []
    for skill in TECH_SKILLS + SOFT_SKILLS:
        if skill in text_lower:
            found.append(skill)
    return list(set(found))


def cosine_similarity_numpy(vec1, vec2) -> float:
    import numpy as np
    dot = np.dot(vec1, vec2)
    norm = np.linalg.norm(vec1) * np.linalg.norm(vec2)
    return float(dot / norm) if norm > 0 else 0.0


def keyword_similarity(resume_text: str, jd_text: str) -> float:
    """Fallback similarity using keyword overlap (Jaccard)"""
    stop = {"the","a","an","and","or","in","on","at","to","for","of","with","is","was","be","this","that"}
    def tokenize(t):
        return set(w for w in re.findall(r'\b\w+\b', t.lower()) if len(w) > 3 and w not in stop)
    r_words = tokenize(resume_text)
    j_words = tokenize(jd_text)
    if not j_words:
        return 0.5
    intersection = r_words & j_words
    return len(intersection) / len(j_words)


# ─── Main endpoint ─────────────────────────────────────────────────────────────
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_resume(req: AnalyzeRequest):
    if len(req.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text too short")
    if len(req.job_description.strip()) < 20:
        raise HTTPException(status_code=400, detail="Job description too short")

    # ── Semantic similarity ──
    model = get_model()
    if model is not None:
        embeddings = model.encode([req.resume_text, req.job_description])
        raw_sim = cosine_similarity_numpy(embeddings[0], embeddings[1])
    else:
        raw_sim = keyword_similarity(req.resume_text, req.job_description)

    match_score = int(min(max(raw_sim * 100, 0), 100))

    # ── Skill extraction ──
    resume_skills = extract_skills(req.resume_text)
    jd_skills = extract_skills(req.job_description)

    matched_skills = [s for s in jd_skills if s in resume_skills]
    missing_skills = [s for s in jd_skills if s not in resume_skills]

    # ── Generate suggestions ──
    suggestions = []
    if missing_skills:
        top_missing = missing_skills[:4]
        suggestions.append(f"Add hands-on experience with: {', '.join(top_missing)}")
    if not re.search(r'\d+%|\d+ years?|\d+ (projects?|teams?|users?)', req.resume_text, re.I):
        suggestions.append("Quantify your achievements (e.g. 'reduced load time by 30%')")
    if len(req.resume_text.split()) < 250:
        suggestions.append("Expand your resume — add more detail to experience and projects sections")
    if "project" not in req.resume_text.lower():
        suggestions.append("Add a Projects section showcasing relevant work")
    if match_score < 50:
        suggestions.append("Tailor your resume more closely to the job description keywords")

    # ── Summary ──
    level = "strong" if match_score >= 70 else "moderate" if match_score >= 45 else "low"
    summary = (
        f"Your resume shows a {level} match ({match_score}%) with this job description. "
        f"You matched {len(matched_skills)} of {len(jd_skills)} key skills. "
        + (f"Focus on adding: {', '.join(missing_skills[:3])}." if missing_skills else "Your skill coverage looks good!")
    )

    return AnalyzeResponse(
        match_score=match_score,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        suggestions=suggestions,
        summary_feedback=summary,
    )


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": _model is not None}
