// services/conversationEngine.js
'use strict';

const { callGemini } = require('../config/gemini');
const botDefinitions = require('./botDefinitions');
const crudService = require('./crudService');
const calendarService = require('./calendarService');
const emailService = require('./emailService');
const Conversation = require('../models/Conversation');
const { createZoomMeeting } = require('./zoomMeetingService'); // optional
const util = require('util');

const LOG_PREFIX = '[conversationEngine]';

/* ---------------------------
   Date/time helpers (robust)
   --------------------------- */
function pad(n) { return String(n).padStart(2, '0'); }

function parseTimeShort(timeStr) {
  if (!timeStr) return null;
  const s = String(timeStr).trim().toLowerCase();
  // 5pm, 5:30 pm
  const ampm = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2] || '0', 10);
    const mer = ampm[3];
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return `${pad(h)}:${pad(m)}`;
  }
  // hh:mm
  const hhmm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) return `${pad(parseInt(hhmm[1], 10))}:${pad(parseInt(hhmm[2], 10))}`;
  // single number -> hour
  const onlyNum = s.match(/^(\d{1,2})$/);
  if (onlyNum) return `${pad(parseInt(onlyNum[1], 10))}:00`;
  return null;
}

/* Robust natural date parser with multiple heuristics.
   If callGemini is available, use it as last-resort normalizer.
*/
async function parseNaturalDateTime(text) {
  if (!text) return null;
  const raw = String(text).trim();
  const s = raw.toLowerCase();

  const now = new Date();
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);

  // ISO-like: YYYY-MM-DD or YYYY/MM/DD
  const iso = s.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]), m = Number(iso[2]) - 1, d = Number(iso[3]);
    date = new Date(y, m, d);
  }

  // DMY: 25/12/2025 or 25-12-2025
  const dmy = s.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmy) {
    const d = Number(dmy[1]), m = Number(dmy[2]) - 1, y = Number(dmy[3]);
    date = new Date(y, m, d);
  }

  if (s.includes('today')) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (s.includes('tomorrow')) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else {
    // next monday, friday etc
    const weekdayMap = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6, sunday:0 };
    for (const [name, idx] of Object.entries(weekdayMap)) {
      if (s.includes(`next ${name}`) || s.match(new RegExp(`\\b${name}\\b`))) {
        if (s.includes(`next ${name}`)) {
          // compute next occurrence
          const today = now.getDay();
          const diff = (idx + 7 - today) % 7 || 7;
          date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
        } else {
          // exact weekday mention may be ambiguous; choose next occurrence
          const today = now.getDay();
          const diff = (idx + 7 - today) % 7 || 7;
          date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
        }
        break;
      }
    }
  }

  // time in text
  const t = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (t) {
    let hour = Number(t[1]);
    const minute = Number(t[2] || 0);
    if (t[3] === 'pm' && hour < 12) hour += 12;
    if (t[3] === 'am' && hour === 12) hour = 0;
    date.setHours(hour, minute, 0, 0);
  } else {
    // if no time, set default 09:00
    date.setHours(9,0,0,0);
  }

  // Basic sanity: if parsed date is in the past, prefer next year (useful for mm-dd)
  if (date < now) {
    const nextYear = new Date(date);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    // only bump year if it's obviously a short mention (e.g., "Dec 5" and today already passed)
    if ((date - now) < 0) {
      // keep as-is if it's within next 48 hours
      if ( (date.getTime() - now.getTime()) < -48 * 3600 * 1000 ) {
        date = nextYear;
      }
    }
  }

  // If still invalid or suspicious, fallback to Gemini (if available)
  if (isNaN(date.getTime()) && typeof callGemini === 'function') {
    try {
      const prompt = `
Convert the following natural language date/time into an ISO 8601 timestamp (UTC): "${raw}".
Return only JSON: {"iso":"<ISO>","valid":true} or {"iso":null,"valid":false}
`;
      const ai = await callGemini(prompt);
      const txt = typeof ai === 'string' ? ai : (ai.text || JSON.stringify(ai));
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed && parsed.valid && parsed.iso) {
          const d = new Date(parsed.iso);
          if (!isNaN(d.getTime())) return d;
        }
      }
    } catch (e) {
      // ignore gemini fallback errors
    }
  }

  if (isNaN(date.getTime())) return null;
  return date;
}

/* ---------------------------
   Field validation helpers
   --------------------------- */
async function validateField(field, rawValue) {
  const valueRaw = (rawValue === undefined || rawValue === null) ? '' : String(rawValue).trim();

  if (field.type === 'email' || field.name.toLowerCase().includes('email')) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueRaw);
    if (!ok) return { valid: false, error: 'Invalid email format.' };
    return { valid: true, value: valueRaw.toLowerCase() };
  }

  if (field.type === 'number' || (field.name || '').toLowerCase().includes('count') || (field.name || '').toLowerCase().includes('number')) {
    const n = Number(valueRaw);
    if (isNaN(n)) return { valid: false, error: 'Please enter a valid number.' };
    return { valid: true, value: n };
  }

  if (field.type === 'boolean') {
    const s = valueRaw.toLowerCase();
    if (['yes','true','y','1'].includes(s)) return { valid: true, value: true };
    if (['no','false','n','0'].includes(s)) return { valid: true, value: false };
    return { valid: false, error: 'Answer must be yes or no.' };
  }

  if (field.type === 'time' || (field.name || '').toLowerCase().includes('time')) {
    const t = parseTimeShort(valueRaw);
    if (!t) return { valid: false, error: "Could not parse time. Try '10:00' or '7pm'." };
    return { valid: true, value: t };
  }

  if (field.type === 'date' || field.type === 'datetime' || (field.name || '').toLowerCase().includes('date')) {
    // Try parseNaturalDateTime, then Date.parse fallback
    const dt = await (async () => {
      try {
        const d = await parseNaturalDateTime(valueRaw);
        if (d) return d.toISOString();
      } catch (e) {}
      // last-resort
      const d2 = new Date(valueRaw);
      if (!isNaN(d2.getTime())) return d2.toISOString();
      return null;
    })();

    if (!dt) return { valid: false, error: 'Could not parse date/time.' };
    return { valid: true, value: dt };
  }

  // Default: accept free text (trimmed)
  return { valid: true, value: valueRaw };
}

/* ---------------------------
   Conversation step-by-step processor
   - supports exit/back/skip
   --------------------------- */
async function process(conversation, userMessage, context = {}) {
  const botDef = botDefinitions[conversation.botType];
  if (!botDef) {
    conversation.status = 'error';
    await conversation.save().catch(()=>{});
    return `❌ Bot ${conversation.botType} not supported.`;
  }

  conversation.collectedData ||= {};
  const lc = (userMessage || '').toString().trim().toLowerCase();

  // Global control commands
  if (['exit','cancel','quit','stop'].includes(lc)) {
    conversation.status = 'cancelled';
    await conversation.save().catch(()=>{});
    return '❌ Conversation cancelled. You can start again anytime.';
  }

  if (lc === 'back') {
    if (conversation.currentStep > 0) {
      conversation.currentStep--;
      await conversation.save();
      const field = botDef.fields[conversation.currentStep];
      return `⬅️ Going back.\n\n${field.question}`;
    } else {
      return 'You are at the first step already.';
    }
  }

  if (lc === 'skip') {
    const field = botDef.fields[conversation.currentStep];
    if (!field.required) {
      conversation.currentStep++;
      await conversation.save();
      if (conversation.currentStep >= botDef.fields.length) {
        // finished
        try {
          const result = await completeBot(conversation, context.user || { email: conversation.email });
          return result;
        } catch (e) {
          console.error(LOG_PREFIX, 'completeBot error after skip:', e);
          return '❌ Failed to complete the flow.';
        }
      }
      const next = botDef.fields[conversation.currentStep];
      return next.question;
    } else {
      return '❌ This field is required and cannot be skipped.';
    }
  }

  // Validate current field
  const field = botDef.fields[conversation.currentStep];
  if (!field) {
    conversation.status = 'error';
    await conversation.save().catch(()=>{});
    return '⚠️ Internal error: missing field definition.';
  }

  const validation = await validateField(field, userMessage);
  if (!validation.valid) {
    return `❌ ${validation.error}\n\n${field.question}`;
  }

  // Save validated value
  conversation.collectedData[field.name] = validation.value;
  conversation.currentStep++;
  await conversation.save().catch(()=>{});

  // If finished, complete
  if (conversation.currentStep >= botDef.fields.length) {
    try {
      const result = await completeBot(conversation, context.user || { email: conversation.email });
      return result;
    } catch (e) {
      console.error(LOG_PREFIX, 'completeBot error:', e);
      return '❌ Failed to complete the flow.';
    }
  }

  // Ask next question
  const next = botDef.fields[conversation.currentStep];
  return next.question;
}

/* ---------------------------
   completeBot: finalise conversation-based creation
   - persist record via crudService.create
   - send emails / schedule reminders / create meetings
   --------------------------- */
async function completeBot(conversation, userObj = {}) {
  const botType = conversation.botType;
  const botDef = botDefinitions[botType];
  if (!botDef) {
    conversation.status = 'error';
    await conversation.save().catch(()=>{});
    return `❌ Bot ${botType} not supported.`;
  }

  const data = conversation.collectedData || {};
  const userEmail = (userObj && userObj.email) || conversation.email || null;

  // For safety, always ensure required fields are present
  const missing = [];
  for (const f of botDef.fields || []) {
    if (f.required && (data[f.name] === undefined || data[f.name] === null || (typeof data[f.name] === 'string' && data[f.name].trim() === ''))) {
      missing.push(f.name);
    }
  }
  if (missing.length) {
    conversation.status = 'active';
    await conversation.save().catch(()=>{});
    return `❌ Missing required fields: ${missing.join(', ')}. Please provide them.`;
  }

  // Persist via crudService
  let saved;
  try {
    saved = await crudService.createRecord({
  botType,
  userEmail,
  data
});
  } catch (err) {
    console.error(LOG_PREFIX, 'DB save error:', err);
    conversation.status = 'error';
    await conversation.save().catch(()=>{});
    return '❌ Could not save record. Try again later.';
  }

  // mark conversation done
  conversation.status = 'completed';
  conversation.completedAt = new Date();
  await conversation.save().catch(()=>{});

  // Build response summary
  let resp = `✅ ${ (botDef.name || botType).toUpperCase() } CREATED!\n\n`;
  resp += generateSummary(data);

  // If meeting -> create zoom / calendar entry if supported
  if (botType === 'meeting') {
    try {
      // Determine startISO if possible
      let startISO = null;
      if (data.date && data.date.includes('T')) startISO = data.date;
      if (!startISO && data.startDate && data.startDate.includes('T')) startISO = data.startDate;
      if (!startISO && data.dueDate && data.dueDate.includes('T')) startISO = data.dueDate;
      if (!startISO && data.date && data.time) startISO = `${data.date}T${data.time}:00`;

      if (startISO) data.startISO = new Date(startISO).toISOString();

      // create zoom/zoho meeting - prefer configured service
      let meetingInfo = null;
      if (typeof createZoomMeeting === 'function') {
        try {
          meetingInfo = await createZoomMeeting(data);
          if (meetingInfo && meetingInfo.joinUrl) {
            resp += `\n📅 Meeting link: ${meetingInfo.joinUrl}`;
            data.joinUrl = meetingInfo.joinUrl;
            data.startUrl = meetingInfo.startUrl || null;
            // try persist extra meeting info back to DB
            try { await crudService.updateById(saved._id, userEmail, { meeting: meetingInfo, joinUrl: meetingInfo.joinUrl, startUrl: meetingInfo.startUrl, startISO: data.startISO || null }); } catch(e){/*non-fatal*/ }
          }
        } catch (e) {
          console.warn(LOG_PREFIX, 'createZoomMeeting failed:', e?.message || e);
          resp += `\n⚠️ Meeting creation failed (external).`;
        }
      }
    } catch (e) {
      console.warn(LOG_PREFIX, 'meeting handling error:', e?.message || e);
    }
  }

  // EMAIL: send confirmation to owner if email present and autoEmail or conversation requested it
  try {
    if (userEmail && (botDef.autoEmail || botDef.emailRequired || conversation.sendEmail || conversation.wantEmail)) {
      await emailService.sendConfirmation(userEmail, botType, data).catch(err => {
        console.warn(LOG_PREFIX, 'sendConfirmation owner failed:', err?.message || err);
      });
      resp += `\n\n📧 Email sent to ${userEmail}`;
    }
  } catch (e) {
    console.warn(LOG_PREFIX, 'owner email send failed:', e);
  }

  // EMAIL: if attendees present (meeting/interview)
  try {
    if (data.attendees && (botType === 'meeting' || botType === 'interview')) {
      const attendees = Array.isArray(data.attendees) ? data.attendees : data.attendees.split(',').map(x => x.trim()).filter(Boolean);
      for (const em of attendees) {
        try {
          await emailService.sendConfirmation(em, botType, data);
        } catch (e) {
          console.warn(LOG_PREFIX, 'sendConfirmation attendee failed:', em, e?.message || e);
        }
      }
      resp += `\n📧 Attendee emails queued/sent.`;
    }
    // interviewers
    if (data.interviewers && botType === 'interview') {
      const ints = Array.isArray(data.interviewers) ? data.interviewers : String(data.interviewers).split(',').map(x=>x.trim()).filter(Boolean);
      for (const em of ints) {
        try { await emailService.sendConfirmation(em, botType, data); } catch(e){ console.warn(LOG_PREFIX,'sendConfirmation interviewer failed:', em, e?.message || e); }
      }
    }
  } catch (e) {
    console.warn(LOG_PREFIX, 'attendee emails error:', e);
  }

  // Schedule reminders if applicable
  try {
    const dateField = data.date || data.dueDate || data.startDate || data.departureDate || null;
    if (dateField && botDef.autoEmail) {
      await emailService.scheduleReminder(userEmail, saved._id, botType, data).catch(e => {
        console.warn(LOG_PREFIX, 'scheduleReminder failed:', e?.message || e);
      });
      resp += `\n⏰ Reminder scheduled.`;
    }
  } catch (e) {
    console.warn(LOG_PREFIX, 'reminder scheduling error:', e);
  }

  return resp;
}

/* ---------------------------
   executeDirect: single-shot webhook create path
   - userOrObj: { email } or user model or string email
   --------------------------- */
async function executeDirect(userOrObj, botType, data, sendEmail = false) {
  const botDef = botDefinitions[botType];
  if (!botDef) throw new Error('Unknown botType: ' + botType);

  const userEmail = (userOrObj && userOrObj.email) || (typeof userOrObj === 'string' ? userOrObj : null);

  // 1) Normalize incoming fields:
  try {
    for (const key of Object.keys(data || {})) {
      const lower = key.toLowerCase();
      // Date-like
      if (lower.includes('date') || lower.includes('day')) {
        if (typeof data[key] === 'string' && !data[key].includes('T')) {
          const d = await parseNaturalDateTime(String(data[key]));
          if (d) data[key] = d.toISOString();
        }
      }
      // Time-like
      if (lower.includes('time') && typeof data[key] === 'string') {
        const t = parseTimeShort(String(data[key]));
        if (t) data[key] = t;
      }
    }
  } catch (e) {
    console.warn(LOG_PREFIX, 'normalization error:', e?.message || e);
  }

  // Convert date ISO -> separate date/time where applicable
  function extractTimeFromISO(isoString) {
    try {
      const d = new Date(isoString);
      if (!isNaN(d.getTime())) {
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    } catch (e) {}
    return null;
  }
  function cleanDateOnly(isoString) {
    try { return isoString.split('T')[0]; } catch(e){ return isoString; }
  }

  const dateKeys = ['date','startDate','dueDate','departureDate'];
  for (const key of dateKeys) {
    if (data[key] && typeof data[key] === 'string' && data[key].includes('T')) {
      if (!data.time) data.time = extractTimeFromISO(data[key]);
      data.date = cleanDateOnly(data[key]);
    }
  }

  // 2) Persist via CRUD
  let saved;
  try {
    saved = await crudService.createRecord({
  botType,
  userEmail,
  data
});

  } catch (err) {
    console.error(LOG_PREFIX, 'crudService.create failed:', err);
    throw err;
  }

  // 3) Post-create tasks: meeting creation, emails, reminders
  let resp = `✅ ${ (botDef.name || botType).toUpperCase() } CREATED!\n\n`;
  resp += generateSummary(data);

  if (botType === 'meeting') {
    try {
      let startISO = null;
      if (data.date && data.date.includes('T')) startISO = data.date;
      if (!startISO && data.startDate && data.startDate.includes('T')) startISO = data.startDate;
      if (!startISO && data.dueDate && data.dueDate.includes('T')) startISO = data.dueDate;
      if (!startISO && data.date && data.time) startISO = `${data.date}T${data.time}:00`;
      if (startISO) data.startISO = new Date(startISO).toISOString();

      if (typeof createZoomMeeting === 'function') {
        try {
          const meeting = await createZoomMeeting(data);
          resp += `\n📅 Meeting link: ${meeting.joinUrl}`;
          data.joinUrl = meeting.joinUrl;
          data.startUrl = meeting.startUrl || null;
          try { await crudService.updateById(saved._id, userEmail, { meeting, joinUrl: meeting.joinUrl, startUrl: meeting.startUrl, startISO: data.startISO || null }); } catch(e){/*non-fatal*/ }
        } catch (err) {
          console.warn(LOG_PREFIX, 'createZoomMeeting failed:', err?.message || err);
          resp += `\n⚠️ Meeting creation failed (external).`;
        }
      }
    } catch (e) {
      console.warn(LOG_PREFIX, 'meeting handling error:', e);
    }
  }

  // Send confirmation to owner if requested or bot autoEmail
  try {
    if (userEmail && (sendEmail || botDef.autoEmail || botDef.emailRequired)) {
      await emailService.sendConfirmation(userEmail, botType, data).catch(err => {
        console.warn(LOG_PREFIX,'sendConfirmation owner failed:', err?.message || err);
      });
      resp += `\n\n📧 Email sent to ${userEmail}`;
    }
  } catch (e) {
    console.warn(LOG_PREFIX,'owner email error:', e);
  }

  // Send to attendees/interviewers
  try {
    if (data.attendees && (botType === 'meeting' || botType === 'interview')) {
      const attendees = Array.isArray(data.attendees) ? data.attendees : String(data.attendees).split(',').map(x=>x.trim()).filter(Boolean);
      for (const em of attendees) {
        try { await emailService.sendConfirmation(em, botType, data); } catch(e){ console.warn(LOG_PREFIX,'attendee email fail:', em, e?.message || e); }
      }
      resp += `\n📧 Attendee emails queued/sent.`;
    }
    if (data.interviewers && botType === 'interview') {
      const ints = Array.isArray(data.interviewers) ? data.interviewers : String(data.interviewers).split(',').map(x=>x.trim()).filter(Boolean);
      for (const em of ints) {
        try { await emailService.sendConfirmation(em, botType, data); } catch(e){ console.warn(LOG_PREFIX,'interviewer email fail:', em, e?.message || e); }
      }
    }
  } catch (e) { console.warn(LOG_PREFIX,'attendees handling error:', e); }

  // Schedule reminders if needed
  try {
    const dateField = data.date || data.dueDate || data.startDate || data.departureDate;
    if (dateField && botDef.autoEmail) {
      await emailService.scheduleReminder(userEmail, saved._id, botType, data).catch(e => { console.warn(LOG_PREFIX,'scheduleReminder failed:', e?.message || e); });
      resp += `\n⏰ Reminder scheduled.`;
    }
  } catch (e) { console.warn(LOG_PREFIX,'reminder schedule error:', e); }

  // Return readable response
  return resp;
}

/* ---------------------------
   Utilities
   --------------------------- */
function generateSummary(data) {
  let out = '';
  for (const [k,v] of Object.entries(data || {})) {
    if (v === undefined || v === null || v === '') continue;
    const key = k.charAt(0).toUpperCase() + k.slice(1);
    out += `🔹 ${ key }: ${ v }\n`;
  }
  return out;
}

module.exports = {
  process,
  executeDirect,
  parseNaturalDateTime
};
