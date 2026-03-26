/**
 * ATS (Applicant Tracking System) Scoring Engine
 * Scores resume based on keywords, formatting, sections, and structure
 */

const SECTION_PATTERNS = {
  contact: /(\b(email|phone|linkedin|github|address|contact)\b)/i,
  summary: /\b(summary|objective|profile|about)\b/i,
  experience: /\b(experience|work history|employment|career)\b/i,
  education: /\b(education|degree|university|college|school)\b/i,
  skills: /\b(skills|technologies|technical skills|competencies)\b/i,
  projects: /\b(projects|portfolio|work samples)\b/i,
};

const FORMATTING_RED_FLAGS = [
  { pattern: /table|column/i, issue: 'Tables and multi-column layouts may confuse ATS parsers' },
  { pattern: /\.jpg|\.png|\.gif/i, issue: 'Images in resume are not ATS-readable' },
  { pattern: /<header>|<footer>/i, issue: 'Headers/footers may be ignored by ATS' },
];

const POWER_VERBS = [
  'developed', 'implemented', 'designed', 'led', 'managed', 'created',
  'improved', 'increased', 'reduced', 'launched', 'built', 'optimized',
  'delivered', 'achieved', 'collaborated', 'mentored', 'architected',
];

/**
 * Main ATS scoring function
 */
exports.calculateATSScore = (resumeText, jobDescription = '') => {
  const resumeLower = resumeText.toLowerCase();
  const report = {
    atsScore: 0,
    keywordsFound: [],
    keywordsMissing: [],
    formattingIssues: [],
    sectionPresence: {},
    recommendations: [],
  };

  // 1. Section check (25 points)
  let sectionScore = 0;
  Object.entries(SECTION_PATTERNS).forEach(([section, pattern]) => {
    const found = pattern.test(resumeText);
    report.sectionPresence[`has${capitalize(section)}`] = found;
    if (found) sectionScore += 4;
    else report.recommendations.push(`Add a clear "${capitalize(section)}" section heading`);
  });
  sectionScore = Math.min(sectionScore, 25);

  // 2. Keyword matching against JD (35 points)
  let keywordScore = 0;
  if (jobDescription) {
    const jdWords = extractKeywords(jobDescription);
    jdWords.forEach(kw => {
      if (resumeLower.includes(kw.toLowerCase())) {
        report.keywordsFound.push(kw);
        keywordScore += Math.floor(35 / Math.max(jdWords.length, 1));
      } else {
        report.keywordsMissing.push(kw);
      }
    });
    keywordScore = Math.min(keywordScore, 35);
    if (report.keywordsMissing.length > 0) {
      report.recommendations.push(
        `Include these keywords from the job description: ${report.keywordsMissing.slice(0, 5).join(', ')}`
      );
    }
  } else {
    keywordScore = 20; // Baseline if no JD provided
  }

  // 3. Action verbs / power words (20 points)
  const foundVerbs = POWER_VERBS.filter(v => resumeLower.includes(v));
  const verbScore = Math.min(Math.floor((foundVerbs.length / 8) * 20), 20);
  if (foundVerbs.length < 5) {
    report.recommendations.push('Use more action verbs like: developed, implemented, led, optimized');
  }

  // 4. Quantified achievements (10 points)
  const hasNumbers = /\d+%|\d+ (years?|months?|projects?|teams?|people|users?|million|billion)/i.test(resumeText);
  const quantScore = hasNumbers ? 10 : 0;
  if (!hasNumbers) {
    report.recommendations.push('Quantify your achievements with metrics (e.g., "increased performance by 40%")');
  }

  // 5. Length check (10 points)
  const wordCount = resumeText.split(/\s+/).length;
  let lengthScore = 0;
  if (wordCount >= 300 && wordCount <= 700) {
    lengthScore = 10;
  } else if (wordCount < 300) {
    lengthScore = 4;
    report.recommendations.push('Resume is too short — aim for 400-600 words');
  } else {
    lengthScore = 6;
    report.recommendations.push('Resume may be too long — ATS prefers concise, 1-2 page resumes');
  }

  // Formatting checks (no score deduction, just flags)
  FORMATTING_RED_FLAGS.forEach(({ issue }) => {
    // Note: text-extracted resumes won't have HTML, but good to flag
  });

  report.atsScore = Math.min(
    sectionScore + keywordScore + verbScore + quantScore + lengthScore,
    100
  );

  return report;
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractKeywords(text) {
  // Extract meaningful words (nouns, skills, technologies) from JD
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'we', 'you', 'they', 'their', 'our', 'your',
  ]);

  const words = text
    .replace(/[^\w\s+#]/g, ' ')
    .split(/\s+/)
    .map(w => w.toLowerCase().trim())
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Deduplicate and return top keywords
  return [...new Set(words)].slice(0, 30);
}
