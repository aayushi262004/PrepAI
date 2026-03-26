# PrepAI — AI-Powered Interview & Resume Platform

## Tech Stack
- **Frontend**: React 18 + Vite + TailwindCSS + Framer Motion
- **Backend**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **Auth**: JWT (or swap with Firebase)
- **AI**: Groq API (LLM), Google Text-to-Speech
- **NLP**: Python microservice (sentence-transformers / BERT) for resume analysis
- **File Parsing**: pdf-parse, mammoth

---

## Folder Structure
```
prepai/
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── utils/
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       ├── context/
│       └── utils/
└── nlp-service/   (Python FastAPI)
```

---

## Quick Start

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env  # Fill in your keys
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. NLP Python Service
```bash
cd nlp-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

---

## Environment Variables

### Backend `.env`
```
MONGO_URI=mongodb://localhost:27017/prepai
JWT_SECRET=your_jwt_secret_here
GROQ_API_KEY=your_groq_api_key
MURF_API_KEY=your_google_tts_key
NLP_SERVICE_URL=http://localhost:8001
PORT=5000
CLIENT_URL=http://localhost:5173
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:5000/api
```
