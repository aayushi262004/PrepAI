const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Generate 5 mock interview questions using Groq LLM
 */
exports.generateInterviewQuestions = async ({ jobTitle, jobDescription, skills, yearsOfExperience }) => {
  const skillsText = skills && skills.length > 0 ? skills.join(', ') : 'not specified';

  const prompt = `You are an expert technical interviewer. Generate exactly 5 interview questions for the following candidate profile.

Job Title: ${jobTitle}
Job Description: ${jobDescription}
Key Skills: ${skillsText}
Years of Experience: ${yearsOfExperience}

Requirements:
- Mix of behavioral (2), technical (2), and situational (1) questions
- Questions should be appropriate for ${yearsOfExperience} year(s) of experience
- Each question should be clear, specific, and open-ended
- No follow-up sub-questions

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  { "id": 1, "type": "behavioral", "question": "..." },
  { "id": 2, "type": "technical", "question": "..." },
  { "id": 3, "type": "technical", "question": "..." },
  { "id": 4, "type": "behavioral", "question": "..." },
  { "id": 5, "type": "situational", "question": "..." }
]`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1000,
  });

  const content = completion.choices[0]?.message?.content || '[]';

  // Strip any markdown code fences just in case
  const cleaned = content.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
};

/**
 * Generate overall feedback for completed interview
 */
exports.generateInterviewFeedback = async (questions) => {
  const qaPairs = questions
    .filter(q => q.userAnswer)
    .map((q, i) => `Q${i + 1}: ${q.question}\nAnswer: ${q.userAnswer}`)
    .join('\n\n');

  if (!qaPairs) return 'No answers provided to evaluate.';

  const prompt = `You are an expert career coach. Evaluate these interview answers and provide constructive feedback.

${qaPairs}

Provide:
1. An overall performance score (0-100)
2. Strengths observed (2-3 bullet points)
3. Areas for improvement (2-3 bullet points)
4. A brief encouraging summary paragraph

Respond ONLY with valid JSON:
{
  "score": 75,
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "summary": "..."
}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 800,
  });

  const content = completion.choices[0]?.message?.content || '{}';
  const cleaned = content.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
};
