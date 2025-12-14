const axios = require("axios");

console.log("Gemini Using:", process.env.GEMINI_API_URL);

async function callGemini(prompt) {
  try {
    const response = await axios.post(
      process.env.GEMINI_API_URL,   
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    return response.data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error("Gemini API Error:", error.response?.data || error.message);
    throw new Error("AI processing failed");
  }
}

module.exports = { callGemini };
