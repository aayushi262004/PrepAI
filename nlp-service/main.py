"""
PrepAI NLP Service v3 — RAG-powered Career Assistant
=====================================================
Endpoints:
  POST /embed   — chunk resume, embed, store in ChromaDB
  POST /chat    — RAG query: embed question, retrieve chunks, LLM answer
  DELETE /embed/{user_id} — clear stored resume for a user
  POST /report  — combined ATS score + skill-gap analysis (Resume Analyzer)
  GET  /health  — health check

Run locally:
  pip install -r requirements.txt
  GROQ_API_KEY=gsk_xxx uvicorn app:app --reload --port 8001

Deploy to HuggingFace Spaces (Docker):
  Same Dockerfile, just replace app.py
"""

import os
import json
import re
import uuid
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PrepAI NLP Service", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_LLM = "llama-3.3-70b-versatile"
MODEL_EMBED = "all-MiniLM-L6-v2"  # 384-dim, fast, good quality

# ─── Lazy singletons ──────────────────────────────────────────────────────────
# We initialize these on first use so the container boots fast
# and doesn't crash if env vars are missing

_groq_client = None
_embed_model = None
_chroma_client = None
_chroma_collection = None


def get_groq():
    global _groq_client
    if _groq_client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="GROQ_API_KEY not set. Add it in HuggingFace Space Secrets."
            )
        from groq import Groq
        _groq_client = Groq(api_key=api_key)
    return _groq_client


def get_embed_model():
    """Load sentence-transformers model. Downloads ~90MB on first call."""
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer(MODEL_EMBED)
    return _embed_model


def get_chroma():
    """
    Get or create ChromaDB collection.
    ChromaDB is an in-memory vector database — perfect for HuggingFace Spaces.
    Data lives as long as the container is running.
    For persistence across restarts, you'd use chromadb.PersistentClient(path="./chroma_db")
    but on HF free tier, ephemeral is fine since resumes are re-embedded on demand.
    """
    global _chroma_client, _chroma_collection
    if _chroma_collection is None:
        import chromadb
        _chroma_client = chromadb.Client()  # in-memory
        _chroma_collection = _chroma_client.get_or_create_collection(
            name="resumes",
            metadata={"hnsw:space": "cosine"}  # use cosine similarity for search
        )
    return _chroma_collection


# ─── Schemas ──────────────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    user_id: str        # MongoDB user _id — used to namespace stored chunks
    resume_text: str


class EmbedResponse(BaseModel):
    user_id: str
    chunks_stored: int
    message: str


class ChatRequest(BaseModel):
    user_id: str
    message: str
    chat_history: Optional[List[dict]] = []  # [{"role": "user"|"assistant", "content": "..."}]


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]  # which resume chunks were used


class ReportRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = ""


class SectionScores(BaseModel):
    skills_match: int
    experience_relevance: int
    education_fit: int
    keywords: int
    formatting: int


class ReportResponse(BaseModel):
    score: int
    section_scores: SectionScores
    matched_keywords: List[str]
    missing_keywords: List[str]
    formatting_issues: List[str]
    strengths: List[str]
    recommendations: List[str]
    summary: str
    experience_gap: str
    tone_feedback: str
    semantic_match_score: Optional[int] = None  # ML-computed, independent of the LLM's score — only set when a JD is given


# ─── Chunking ─────────────────────────────────────────────────────────────────

def chunk_resume(resume_text: str) -> List[dict]:
    """
    Split resume into meaningful chunks.

    Strategy: split by common section headings first (Experience, Education, Skills etc.)
    Then for long sections, split further by 200-word windows with 50-word overlap.

    Why overlap? So sentences at chunk boundaries don't lose context.
    e.g. "Led a team of 5..." at the end of chunk 1 also appears at start of chunk 2
    so a question about "team leadership" finds it even if the query matches the beginning.
    """
    # Common resume section patterns
    section_patterns = [
        r'\n(?=(?:EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|CAREER HISTORY))',
        r'\n(?=(?:EDUCATION|ACADEMIC|QUALIFICATIONS))',
        r'\n(?=(?:SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|TECHNOLOGIES))',
        r'\n(?=(?:PROJECTS|PORTFOLIO|KEY PROJECTS))',
        r'\n(?=(?:SUMMARY|OBJECTIVE|PROFILE|ABOUT))',
        r'\n(?=(?:CERTIFICATIONS|CERTIFICATES|AWARDS|ACHIEVEMENTS))',
        r'\n(?=(?:LANGUAGES|INTERESTS|ACTIVITIES|VOLUNTEER))',
    ]

    import re
    combined_pattern = '|'.join(section_patterns)
    sections = re.split(combined_pattern, resume_text, flags=re.IGNORECASE)

    chunks = []
    for i, section in enumerate(sections):
        section = section.strip()
        if len(section) < 30:  # skip tiny fragments
            continue

        words = section.split()

        if len(words) <= 200:
            # Short section — keep as one chunk
            chunks.append({
                "id": str(uuid.uuid4()),
                "text": section,
                "section_index": i
            })
        else:
            # Long section — split into overlapping 200-word windows
            window, overlap = 200, 50
            for start in range(0, len(words), window - overlap):
                chunk_words = words[start:start + window]
                if len(chunk_words) < 20:
                    continue
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "text": " ".join(chunk_words),
                    "section_index": i
                })

    # Fallback: if no sections detected, chunk the whole thing by words
    if not chunks:
        words = resume_text.split()
        for start in range(0, len(words), 150):
            chunk_words = words[start:start + 200]
            if chunk_words:
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "text": " ".join(chunk_words),
                    "section_index": 0
                })

    return chunks


# ─── RAG: Embed endpoint ───────────────────────────────────────────────────────

@app.post("/embed", response_model=EmbedResponse)
async def embed_resume(req: EmbedRequest):
    """
    Step 1 of RAG pipeline:
    1. Chunk the resume into sections
    2. Embed each chunk using sentence-transformers
    3. Store in ChromaDB with user_id as metadata filter

    Called once when user uploads resume to Career Assistant.
    """
    if len(req.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text too short")

    # Step 1: chunk
    chunks = chunk_resume(req.resume_text)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not extract chunks from resume")

    # Step 2: embed all chunks at once (batch is faster than one-by-one)
    model = get_embed_model()
    texts = [c["text"] for c in chunks]
    embeddings = model.encode(texts, show_progress_bar=False).tolist()

    # Step 3: store in ChromaDB
    collection = get_chroma()

    # Delete any existing chunks for this user first (re-upload scenario)
    try:
        existing = collection.get(where={"user_id": req.user_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass  # collection might be empty, that's fine

    # Add new chunks
    collection.add(
        ids=[c["id"] for c in chunks],
        embeddings=embeddings,
        documents=texts,
        metadatas=[{"user_id": req.user_id, "section_index": c["section_index"]} for c in chunks]
    )

    return EmbedResponse(
        user_id=req.user_id,
        chunks_stored=len(chunks),
        message=f"Resume stored as {len(chunks)} searchable chunks. Ready to chat!"
    )


# ─── RAG: Chat endpoint ────────────────────────────────────────────────────────

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Step 2 of RAG pipeline (called every message):
    1. Embed the user's question
    2. Search ChromaDB for the most relevant resume chunks (top 3)
    3. Build prompt: system + retrieved chunks + chat history + question
    4. Call Groq LLaMA with this context
    5. Return grounded answer

    The key insight: LLM never "invents" resume content — it only answers
    based on the actual chunks retrieved. This prevents hallucination.
    """
    collection = get_chroma()

    # Check user has embedded a resume
    try:
        existing = collection.get(where={"user_id": req.user_id})
        if not existing["ids"]:
            raise HTTPException(
                status_code=404,
                detail="No resume found. Please upload your resume first."
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="No resume found. Please upload your resume first.")

    # Step 1: embed the question
    model = get_embed_model()
    question_embedding = model.encode([req.message], show_progress_bar=False).tolist()[0]

    # Step 2: semantic search — find top 3 most relevant chunks
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=min(3, len(existing["ids"])),  # don't ask for more than we have
        where={"user_id": req.user_id}           # only search THIS user's resume
    )

    retrieved_chunks = results["documents"][0] if results["documents"] else []
    sources = retrieved_chunks  # return to frontend for transparency

    # Step 3: build context string from retrieved chunks
    context = "\n\n---\n\n".join(retrieved_chunks)

    # Step 4: build messages with history for multi-turn conversation
    system_prompt = """You are an expert career coach and recruiter assistant.
You have access to the candidate's resume (provided as context below).
Answer ONLY based on what is in the resume context. Do not invent or assume information.
If the resume doesn't contain enough information to answer, say so clearly.
Be specific, actionable, and encouraging. Use bullet points for lists."""

    messages = [{"role": "system", "content": system_prompt}]

    # Add resume context as first user message (always present)
    messages.append({
        "role": "user",
        "content": f"Here is my resume context (most relevant sections for your question):\n\n{context}"
    })
    messages.append({
        "role": "assistant",
        "content": "I've read the relevant sections of your resume. What would you like to know?"
    })

    # Add conversation history (last 6 messages to stay within token limits)
    for msg in req.chat_history[-6:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Add current question
    messages.append({"role": "user", "content": req.message})

    # Step 5: call Groq
    groq = get_groq()
    response = groq.chat.completions.create(
        model=MODEL_LLM,
        messages=messages,
        temperature=0.4,   # slightly higher than scoring — conversational tone
        max_tokens=1000,
    )

    answer = response.choices[0].message.content.strip()

    return ChatResponse(answer=answer, sources=sources)


# ─── Clear stored resume ───────────────────────────────────────────────────────

@app.delete("/embed/{user_id}")
async def clear_resume(user_id: str):
    """Delete stored resume chunks for a user (e.g. when they upload a new resume)"""
    collection = get_chroma()
    try:
        existing = collection.get(where={"user_id": user_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
        return {"message": f"Deleted {len(existing['ids'])} chunks for user {user_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Combined resume report (ATS score + skill-gap analysis in one call) ─────

def call_groq_json(system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> dict:
    client = get_groq()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        response = client.chat.completions.create(
            model=MODEL_LLM, messages=messages, temperature=0.1, max_tokens=max_tokens,
        )
        raw = re.sub(r"```json|```", "", response.choices[0].message.content.strip()).strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        messages.append({"role": "assistant", "content": raw})
        messages.append({"role": "user", "content": "Return ONLY the JSON object, no other text."})
        retry = client.chat.completions.create(
            model=MODEL_LLM, messages=messages, temperature=0.0, max_tokens=max_tokens,
        )
        raw2 = re.sub(r"```json|```", "", retry.choices[0].message.content.strip()).strip()
        return json.loads(raw2)


def compute_semantic_match(resume_text: str, job_description: str) -> int:
    """
    ML-computed match score, independent of the LLM's judgment — pure embedding
    similarity, same model and same chunking used by the RAG pipeline. The JD is
    treated like a RAG "query" against the resume's chunks: embed both sides,
    take the top-3 most similar chunks (mirrors the retrieval step in /chat),
    and average their cosine similarity.
    """
    from sentence_transformers.util import cos_sim

    chunks = chunk_resume(resume_text)
    chunk_texts = [c["text"] for c in chunks] or [resume_text]

    model = get_embed_model()
    chunk_embeddings = model.encode(chunk_texts, show_progress_bar=False)
    jd_embedding = model.encode([job_description], show_progress_bar=False)[0]

    sims = cos_sim(jd_embedding, chunk_embeddings)[0].tolist()
    sims.sort(reverse=True)
    avg_top_sim = sum(sims[:3]) / len(sims[:3])

    # all-MiniLM-L6-v2 cosine similarity for related professional text
    # empirically clusters in ~0.15-0.75, not 0-1 — rescale that range to
    # 0-100 so scores actually spread out instead of bunching near the bottom
    MIN_SIM, MAX_SIM = 0.15, 0.75
    normalized = (avg_top_sim - MIN_SIM) / (MAX_SIM - MIN_SIM)
    return round(max(0.0, min(1.0, normalized)) * 100)


@app.post("/report", response_model=ReportResponse)
async def resume_report(req: ReportRequest):
    """
    One combined LLM call replacing the old separate /ats and /analyze endpoints:
    ATS-style section scoring (skills, experience, education, keywords, formatting)
    plus JD skill-gap fields (experience_gap, tone_feedback) in a single response.
    """
    if len(req.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text too short")
    jd_section = f"\nJob Description:\n{req.job_description}" if req.job_description else "\n(No JD provided — score on general best practices for this resume's field)"
    system_prompt = """You are an expert ATS system and senior technical recruiter. Respond with ONLY valid JSON.
Scoring: skills_match(0-30), experience_relevance(0-25), education_fit(0-15), keywords(0-20), formatting(0-10)."""
    user_prompt = f"""Analyze this resume and return ONLY this JSON:
Resume: {req.resume_text[:3000]}{jd_section[:2000]}
{{"section_scores":{{"skills_match":<0-30>,"experience_relevance":<0-25>,"education_fit":<0-15>,"keywords":<0-20>,"formatting":<0-10>}},"matched_keywords":[],"missing_keywords":[],"formatting_issues":[],"strengths":[],"recommendations":[],"summary":"...","experience_gap":"... (empty string if no JD given)","tone_feedback":"..."}}"""
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
        computed = sum([section_scores.skills_match, section_scores.experience_relevance,
                       section_scores.education_fit, section_scores.keywords, section_scores.formatting])

        semantic_match_score = None
        if req.job_description and req.job_description.strip():
            semantic_match_score = compute_semantic_match(req.resume_text, req.job_description)

        return ReportResponse(
            score=computed, section_scores=section_scores,
            matched_keywords=result.get("matched_keywords", [])[:15],
            missing_keywords=result.get("missing_keywords", [])[:15],
            formatting_issues=result.get("formatting_issues", [])[:5],
            strengths=result.get("strengths", [])[:5],
            recommendations=result.get("recommendations", [])[:6],
            summary=result.get("summary", ""),
            experience_gap=result.get("experience_gap", ""),
            tone_feedback=result.get("tone_feedback", ""),
            semantic_match_score=semantic_match_score,
        )
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=f"Resume report failed: {str(e)}")


@app.get("/health")
async def health():
    key = os.environ.get("GROQ_API_KEY")
    return {
        "status": "ok", "version": "3.0.0",
        "groq_configured": bool(key),
        "groq_key_preview": f"{key[:8]}..." if key else "NOT SET",
    }
