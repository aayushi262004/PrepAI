const axios = require('axios');
const NLP_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8001';

exports.generateReport = async (resumeText, jobDescription = '') => {
  try {
    const res = await axios.post(`${NLP_URL}/report`,
      { resume_text: resumeText, job_description: jobDescription },
      { timeout: 45000 });
    return res.data;
  } catch (err) {
    console.error('NLP /report error:', err.message);
    throw new Error('Resume report service unavailable: ' + err.message);
  }
};
