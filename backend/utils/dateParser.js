const { callGemini } = require('../config/gemini');


async function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  const prompt = `Convert this natural language date/time to ISO 8601 format.
Current date/time: ${new Date().toISOString()}

User input: "${value}"

Return ONLY a JSON object with this exact structure:
{
  "iso": "2024-12-05T15:30:00.000Z",
  "valid": true
}

If the date cannot be parsed, return:
{
  "iso": null,
  "valid": false
}`;

  try {
    const ai = await callGemini(prompt);
    const jsonMatch = ai.match(/\\{[\\s\\S]*\\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.valid ? parsed.iso : null;
  } catch (err) {
    console.error('❌ Date parsing error:', err);
    return null;
  }
}

module.exports = { normalizeDate };
