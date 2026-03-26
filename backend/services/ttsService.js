const axios = require("axios");

/**
 * Convert text to speech using Murf API
 * Returns audio buffer (MP3)
 */
exports.textToSpeech = async (text) => {
  try {
    if (!process.env.MURF_API_KEY) {
      return null;
    }

    const response = await axios.post(
      "https://global.api.murf.ai/v1/speech/stream",
      {
        voice_id: "Matthew",
        text: text,
        locale: "en-US",
        model: "FALCON",
        format: "MP3",
        sampleRate: 24000,
        channelType: "MONO",
      },
      {
        headers: {
          "api-key": process.env.MURF_API_KEY,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer", // IMPORTANT 🔥
      }
    );

    return response.data; // binary audio
  } catch (error) {
    console.error("TTS Error:", error.response?.data || error.message);
    return null;
  }
};