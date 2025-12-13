function isValidEmail(email) {
  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return regex.test(email);
}

/**
 * Extract email from text using Gemini if needed
 */
function extractEmailFromText(text) {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/g;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : null;
}

module.exports = {
  isValidEmail,
  extractEmailFromText
};