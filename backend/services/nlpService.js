const axios = require('axios');

const NLP_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8001';

/**
 * Analyze resume against job description
 * Returns match score, missing skills, matched skills, suggestions
 */
exports.analyzeResume = async (resumeText, jobDescription) => {
  try {
    const response = await axios.post(`${NLP_URL}/analyze`, {
      resume_text: resumeText,
      job_description: jobDescription,
    }, { timeout: 30000 });

    return response.data;
  } catch (err) {
    console.error('NLP service error:', err.message);
    // Fallback: basic keyword matching if NLP service is down
    return fallbackAnalysis(resumeText, jobDescription);
  }
};

/**
 * Fallback keyword-based analysis (no ML required)
 */
function fallbackAnalysis(resumeText, jobDescription) {
  const resumeLower = resumeText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  // Extract common tech keywords from JD
  const techKeywords = [
    'javascript', 'python', 'java', 'react', 'node', 'sql', 'mongodb',
    'docker', 'kubernetes', 'aws', 'git', 'api', 'rest', 'graphql',
    'typescript', 'html', 'css', 'vue', 'angular', 'express', 'django',
    'machine learning', 'data analysis', 'agile', 'scrum', 'ci/cd',
  ];

  const jdKeywords = techKeywords.filter(k => jdLower.includes(k));
  const matchedSkills = jdKeywords.filter(k => resumeLower.includes(k));
  const missingSkills = jdKeywords.filter(k => !resumeLower.includes(k));

  const matchScore = jdKeywords.length > 0
    ? Math.round((matchedSkills.length / jdKeywords.length) * 100)
    : 50;

  const suggestions = [];
  if (missingSkills.length > 0) {
    suggestions.push(`Add experience or projects involving: ${missingSkills.slice(0, 3).join(', ')}`);
  }
  if (!resumeLower.includes('quantif') && !resumeLower.includes('achiev')) {
    suggestions.push('Quantify achievements with numbers and percentages');
  }
  if (resumeLower.split(' ').length < 200) {
    suggestions.push('Expand on your experience sections with more detail');
  }

  return {
    match_score: matchScore,
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
    suggestions,
    summary_feedback: `Your resume matches approximately ${matchScore}% of the job requirements. Focus on adding the missing skills and quantifying your achievements.`,
  };
}
