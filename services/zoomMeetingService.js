// services/zoomMeetingService.js
require("dotenv").config();
const axios = require("axios");
const qs = require("qs");

async function getZoomAccessToken() {
  const tokenUrl = "https://zoom.us/oauth/token";

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


// =============================================
// MAIN FUNCTION — ALWAYS WORKS
// Accepts: { date, time, title, agenda, duration }
// OR: { startISO }
// =============================================
async function createZoomMeeting(data) {
  try {
    console.log("📌 Incoming raw data for Zoom:", data);

    let startISO = null;

    // CASE 1: if startISO exists
    if (data.startISO) {
      startISO = new Date(data.startISO).toISOString();
    }

    // CASE 2: If date contains T → it's already ISO
    if (!startISO && data.date && data.date.includes("T")) {
      startISO = new Date(data.date).toISOString();
    }

    // CASE 3: If date + time provided → combine
    if (!startISO && data.date && data.time) {
      startISO = new Date(`${data.date}T${data.time}:00`).toISOString();
    }

    // If STILL no startISO → error
    if (!startISO) {
      throw new Error("Missing date or time");
    }

    const payload = {
      topic: data.title || "Meeting",
      type: 2,
      start_time: startISO,
      duration: data.duration || 30,
      timezone: "Asia/Kolkata",
      agenda: data.agenda || "",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true
      }
    };

    console.log("\n========= FINAL ZOOM PAYLOAD =========");
    console.log(payload);
    console.log("======================================\n");

    const token = await getZoomAccessToken();

    const res = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      }
    );

    return {
      meetingId: res.data.id,
      joinUrl: res.data.join_url,
      startUrl: res.data.start_url
    };

  } catch (err) {
    console.error("❌ Zoom Create Error:", err.response?.data || err.message);
    throw new Error(JSON.stringify(err.response?.data || err.message));
  }
}

module.exports = { createZoomMeeting };
