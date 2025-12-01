// services/calendarService.js
const { createZoomMeeting } = require("./zoomMeetingService");

async function schedule(data) {
  console.log("📅 calendarService.schedule() INPUT:", JSON.stringify(data, null, 2));

  if (!data.date) throw new Error("Missing date");
  if (!data.time) throw new Error("Missing time");

  // Build ISO datetime for Zoom
  const startISO = new Date(`${data.date}T${data.time}:00`);
  if (isNaN(startISO.getTime())) {
    throw new Error("Invalid date/time");
  }

  const zoomPayload = {
    title: data.title || "Meeting",
    agenda: data.agenda || "",
    duration: data.duration || 30,
    date: data.date,
    time: data.time,
    startISO: startISO.toISOString()
  };

  console.log("📅 Final Zoom Payload:", JSON.stringify(zoomPayload, null, 2));

  // Call Zoom
  const meeting = await createZoomMeeting(zoomPayload);

  return {
    join_link: meeting.joinUrl,
    host_link: meeting.startUrl,
    meeting_id: meeting.meetingId
  };
}

module.exports = { schedule };
