const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

async function createEvent(eventData) {
  try {
    const event = {
      summary: eventData.title,
      description: eventData.description,
      start: { dateTime: eventData.startDateTime, timeZone: 'Asia/Kolkata' },
      end: { dateTime: eventData.endDateTime, timeZone: 'Asia/Kolkata' },
      attendees: eventData.attendees.map(email => ({ email }))
    };

    const response = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: event,
      sendUpdates: 'all'
    });

    return response.data;
  } catch (error) {
    console.error('Calendar Error:', error.message);
    throw error;
  }
}

module.exports = { createEvent };
