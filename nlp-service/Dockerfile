# HuggingFace Spaces requires port 7860
# Build: docker build -t prepai-nlp .
# Run locally: docker run -p 7860:7860 -e GROQ_API_KEY=your_key prepai-nlp

FROM python:3.10-slim

WORKDIR /app

# Install dependencies first (Docker cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY app.py .

# HuggingFace Spaces maps port 7860
EXPOSE 7860

# Use 2 workers for better concurrency on HF free tier
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "2"]
