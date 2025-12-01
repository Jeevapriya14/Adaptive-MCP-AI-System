const axios = require("axios");

// Logs the model URL to confirm correctness
console.log("🔮 Gemini Using:", process.env.GEMINI_API_URL);

async function callGemini(prompt) {
  try {
    const response = await axios.post(
      process.env.GEMINI_API_URL,   // must be gemini-1.5-flash
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

    // Extract generated text
    return response.data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error("❌ Gemini API Error:", error.response?.data || error.message);
    throw new Error("AI processing failed");
  }
}

module.exports = { callGemini };
