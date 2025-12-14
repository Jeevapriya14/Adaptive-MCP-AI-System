const axios = require("axios");
const qs = require("qs");


async function getZoomAccessToken() {
  const tokenUrl = "https://api.zoom.us/oauth/token"; // FIXED URL

  const authString = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.post(
      `${tokenUrl}?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      qs.stringify({}),
      {
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data.access_token;
  } catch (err) {
    console.error("❌ Zoom Token Error:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { getZoomAccessToken };
