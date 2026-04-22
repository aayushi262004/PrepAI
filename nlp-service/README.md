---
title: PrepAI NLP Service
emoji: 🧠
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
---

# PrepAI NLP Service

FastAPI service powering resume analysis and ATS scoring using Groq's LLaMA 3.

## Endpoints

- `POST /analyze` — Resume vs JD skill gap analysis
- `POST /ats` — Full ATS score with section breakdown
- `GET /health` — Health check

## Setup

Add `GROQ_API_KEY` as a **Space Secret** in Settings → Variables and Secrets.

## Local development

```bash
pip install -r requirements.txt
GROQ_API_KEY=your_key uvicorn app:app --reload --port 8001
```
