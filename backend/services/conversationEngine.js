
'use strict';
const botDefinitions = require('./botDefinitions');
const crudService = require('./crudService');
const calendarService = require('./calendarService');
const emailService = require('./emailService');
const Conversation = require('../models/Conversation');
const { createZoomMeeting } = require('./zoomMeetingService'); // optional
const util = require('util');

const LOG_PREFIX = '[conversationEngine]';

function getUniqueEmails(...groups) {
  return Array.from(
    new Set(
      groups
        .flat()
        .filter(Boolean)
        .map((email) => String(email).trim().toLowerCase())
    )
  );
}

function getTaskRecipients(data = {}) {
  return getUniqueEmails(emailService.getTaskRecipientEmails(data));
}

function getNextMissingStepIndex(botDef, collectedData = {}, startIndex = 0) {
  const fields = botDef?.fields || [];
  for (let index = Math.max(0, startIndex); index < fields.length; index++) {
    const field = fields[index];
    const value = collectedData[field.name];
    const empty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    if (empty) return index;
  }
  return fields.length;
}

function isDateLikeField(field = {}) {
  const name = String(field.name || '').toLowerCase();
  return field.type === 'date' ||
    field.type === 'datetime' ||
    name === 'date' ||
    name.endsWith('date') ||
    name.endsWith('at');
}

function isTimeLikeField(field = {}) {
  const name = String(field.name || '').toLowerCase();
  return field.type === 'time' || name === 'time' || name.endsWith('time');
}

function isDateLikeKey(key) {
  const name = String(key || '').toLowerCase();
  return name === 'date' || name.endsWith('date') || name.endsWith('at');
}

function isTimeLikeKey(key) {
  const name = String(key || '').toLowerCase();
  return name === 'time' || name.endsWith('time');
}

function extractTimeFromISO(isoString) {
  try {
    const d = new Date(isoString);
    if (!isNaN(d.getTime())) {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  } catch (e) {}
  return null;
}

function normalizeBotAliases(botType, data = {}) {
  if (!data || typeof data !== 'object') return data;

  if (botType === 'task') {
    if (!data.dueDate && data.date) {
      if (typeof data.date === 'string' && data.time && !data.date.includes('T')) {
        data.dueDate = `${data.date}T${data.time}:00`;
      } else {
        data.dueDate = data.date;
      }
    }
    if (data.dueDate && !data.time && typeof data.dueDate === 'string' && data.dueDate.includes('T')) {
      const derivedTime = extractTimeFromISO(data.dueDate);
      if (derivedTime) data.time = derivedTime;
    }
  }

  if ((botType === 'meeting' || botType === 'reminder' || botType === 'interview') && !data.date) {
    if (data.startDate) data.date = data.startDate;
    else if (data.dueDate) data.date = data.dueDate;
  }

  return data;
}


function pad(n) { return String(n).padStart(2, '0'); }

function parseTimeShort(timeStr) {
  if (!timeStr) return null;
  const s = String(timeStr).trim().toLowerCase();
 
  const ampm = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2] || '0', 10);
    const mer = ampm[3];
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return `${pad(h)}:${pad(m)}`;
  }

  const hhmm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) return `${pad(parseInt(hhmm[1], 10))}:${pad(parseInt(hhmm[2], 10))}`;
 
  const onlyNum = s.match(/^(\d{1,2})$/);
  if (onlyNum) return `${pad(parseInt(onlyNum[1], 10))}:00`;
  return null;
}


async function parseNaturalDateTime(text) {
  if (!text) return null;
  const raw = String(text).trim();
  const s = raw.toLowerCase();

  const now = new Date();
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);

  const iso = s.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]), m = Number(iso[2]) - 1, d = Number(iso[3]);
    date = new Date(y, m, d);
  }

  const dmy = s.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmy) {
    const d = Number(dmy[1]), m = Number(dmy[2]) - 1, y = Number(dmy[3]);
    date = new Date(y, m, d);
  }

  const monthName = s.match(/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:,\s*|\s+)(\d{4})\b/);
  if (monthName) {
    const monthMap = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11
    };
    const month = monthMap[monthName[1]];
    date = new Date(Number(monthName[3]), month, Number(monthName[2]));
  }

  if (s.includes('today')) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (s.includes('tomorrow')) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else {
    const weekdayMap = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6, sunday:0 };
    for (const [name, idx] of Object.entries(weekdayMap)) {
      if (s.includes(`next ${name}`) || s.match(new RegExp(`\\b${name}\\b`))) {
        if (s.includes(`next ${name}`)) {
          const today = now.getDay();
          const diff = (idx + 7 - today) % 7 || 7;
          date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
        } else {
       
          const today = now.getDay();
          const diff = (idx + 7 - today) % 7 || 7;
          date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
        }
        break;
      }
    }
  }

  const explicitTime =
    s.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ||
    s.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)\b/) ||
    s.match(/\b(\d{1,2})\s*(am|pm)\b/) ||
    s.match(/\bat\s+(\d{1,2}):(\d{2})\b/) ||
    s.match(/\b(\d{1,2}):(\d{2})\b/);

  if (explicitTime) {
    let hour = Number(explicitTime[1]);
    const minute = /^\d{1,2}$/.test(String(explicitTime[2] || '')) ? Number(explicitTime[2]) : 0;
    const meridian = explicitTime[3]
      ? explicitTime[3].toLowerCase()
      : (/^(am|pm)$/i.test(String(explicitTime[2] || '')) ? String(explicitTime[2]).toLowerCase() : null);
    if (meridian === 'pm' && hour < 12) hour += 12;
    if (meridian === 'am' && hour === 12) hour = 0;
    date.setHours(hour, minute, 0, 0);
  } else {
    date.setHours(9,0,0,0);
  }

  if (date < now) {
    const nextYear = new Date(date);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    if ((date - now) < 0) {
      if ( (date.getTime() - now.getTime()) < -48 * 3600 * 1000 ) {
        date = nextYear;
      }
    }
  }

  if (isNaN(date.getTime())) return null;
  return date;
}


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

  if (isTimeLikeField(field)) {
    const t = parseTimeShort(valueRaw);
    if (!t) return { valid: false, error: "Could not parse time. Try '10:00' or '7pm'." };
    return { valid: true, value: t };
  }

  if (isDateLikeField(field)) {
    
    const dt = await (async () => {
      try {
        const d = await parseNaturalDateTime(valueRaw);
        if (d) return d.toISOString();
      } catch (e) {}
     
      const d2 = new Date(valueRaw);
      if (!isNaN(d2.getTime())) return d2.toISOString();
      return null;
    })();

    if (!dt) return { valid: false, error: 'Could not parse date/time.' };
    return { valid: true, value: dt };
  }

  return { valid: true, value: valueRaw };
}


async function process(conversation, userMessage, context = {}) {
  const botDef = botDefinitions[conversation.botType];
  if (!botDef) {
    conversation.status = 'error';
    await conversation.save().catch(()=>{});
    return ` Bot ${conversation.botType} not supported.`;
  }

  conversation.collectedData ||= {};
  const lc = (userMessage || '').toString().trim().toLowerCase();
  conversation.currentStep = getNextMissingStepIndex(botDef, conversation.collectedData, conversation.currentStep || 0);

  if (['exit','cancel','quit','stop'].includes(lc)) {
    conversation.status = 'cancelled';
    await conversation.save().catch(()=>{});
    return ' Conversation cancelled. You can start again anytime.';
  }

  if (lc === 'back') {
    if (conversation.currentStep > 0) {
      conversation.currentStep--;
      await conversation.save();
      const field = botDef.fields[conversation.currentStep];
      return ` Going back.\n\n${field.question}`;
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
        try {
          const result = await completeBot(conversation, context.user || { email: conversation.email });
          return result;
        } catch (e) {
          console.error(LOG_PREFIX, 'completeBot error after skip:', e);
          return ' Failed to complete the flow.';
        }
      }
      const next = botDef.fields[conversation.currentStep];
      return next.question;
    } else {
      return ' This field is required and cannot be skipped.';
    }
  }

  const field = botDef.fields[conversation.currentStep];
  if (!field) {
    conversation.status = 'error';
    await conversation.save().catch(()=>{});
    return 'Internal error: missing field definition.';
  }

  const validation = await validateField(field, userMessage);
  if (!validation.valid) {
    return ` ${validation.error}\n\n${field.question}`;
  }

  conversation.collectedData[field.name] = validation.value;
  conversation.currentStep++;
  await conversation.save().catch(()=>{});

  if (conversation.currentStep >= botDef.fields.length) {
    try {
      const result = await completeBot(conversation, context.user || { email: conversation.email });
      return result;
    } catch (e) {
      console.error(LOG_PREFIX, 'completeBot error:', e);
      return ' Failed to complete the flow.';
    }
  }

 
  const next = botDef.fields[conversation.currentStep];
  return next.question;
}


async function completeBot(conversation, userObj = {}) {
  const botType = conversation.botType;
  const botDef = botDefinitions[botType];
  if (!botDef) {
    conversation.status = 'error';
    await conversation.save().catch(()=>{});
    return `Bot ${botType} not supported.`;
  }

  const data = conversation.collectedData || {};
  const userEmail = (userObj && userObj.email) || conversation.email || null;
  const taskRecipients = botType === 'task' ? getTaskRecipients(data) : [];

  const missing = [];
  for (const f of botDef.fields || []) {
    if (f.required && (data[f.name] === undefined || data[f.name] === null || (typeof data[f.name] === 'string' && data[f.name].trim() === ''))) {
      missing.push(f.name);
    }
  }
  if (missing.length) {
    conversation.status = 'active';
    await conversation.save().catch(()=>{});
    return `Missing required fields: ${missing.join(', ')}. Please provide them.`;
  }


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
    return ' Could not save record. Try again later.';
  }

  conversation.status = 'completed';
  conversation.completedAt = new Date();
  await conversation.save().catch(()=>{});

  
  let resp = `${ (botDef.name || botType).toUpperCase() } CREATED!\n\n`;
  resp += generateSummary(data);
  resp += `\n Meeting ID: ${saved._id}`;

  
  if (botType === 'meeting') {
    try {
  
      let startISO = null;
      if (data.date && data.date.includes('T')) startISO = data.date;
      if (!startISO && data.startDate && data.startDate.includes('T')) startISO = data.startDate;
      if (!startISO && data.dueDate && data.dueDate.includes('T')) startISO = data.dueDate;
      if (!startISO && data.date && data.time) startISO = `${data.date}T${data.time}:00`;

      if (startISO) data.startISO = new Date(startISO).toISOString();

    
      let meetingInfo = null;
      if (typeof createZoomMeeting === 'function') {
        try {
          meetingInfo = await createZoomMeeting(data);
          if (meetingInfo && meetingInfo.joinUrl) {
            resp += `\n Meeting link: ${meetingInfo.joinUrl}`;
            data.joinUrl = meetingInfo.joinUrl;
            data.startUrl = meetingInfo.startUrl || null;
            try { await crudService.updateById(saved._id, userEmail, { meeting: meetingInfo, joinUrl: meetingInfo.joinUrl, startUrl: meetingInfo.startUrl, startISO: data.startISO || null }); } catch(e){ }
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

  try {
    if (userEmail && (botDef.autoEmail || botDef.emailRequired || conversation.sendEmail || conversation.wantEmail)) {
      await emailService.sendConfirmation(userEmail, botType, data).catch(err => {
        console.warn(LOG_PREFIX, 'sendConfirmation owner failed:', err?.message || err);
      });
      resp += `\n\n Email sent to ${userEmail}`;
    }
  } catch (e) {
    console.warn(LOG_PREFIX, 'owner email send failed:', e);
  }

  try {
    if (botType === 'task' && taskRecipients.length) {
      for (const em of taskRecipients) {
        if (em === String(userEmail || '').trim().toLowerCase()) continue;
        try {
          await emailService.sendConfirmation(em, botType, data);
        } catch (e) {
          console.warn(LOG_PREFIX, 'sendConfirmation task recipient failed:', em, e?.message || e);
        }
      }
      resp += `\n Task assignee emails queued/sent.`;
    }

    if (data.attendees && (botType === 'meeting' || botType === 'interview')) {
      const attendees = Array.isArray(data.attendees) ? data.attendees : data.attendees.split(',').map(x => x.trim()).filter(Boolean);
      for (const em of attendees) {
        try {
          await emailService.sendConfirmation(em, botType, data);
        } catch (e) {
          console.warn(LOG_PREFIX, 'sendConfirmation attendee failed:', em, e?.message || e);
        }
      }
      resp += `\n Attendee emails queued/sent.`;
    }
   
    if (data.interviewers && botType === 'interview') {
      const ints = Array.isArray(data.interviewers) ? data.interviewers : String(data.interviewers).split(',').map(x=>x.trim()).filter(Boolean);
      for (const em of ints) {
        try { await emailService.sendConfirmation(em, botType, data); } catch(e){ console.warn(LOG_PREFIX,'sendConfirmation interviewer failed:', em, e?.message || e); }
      }
    }
  } catch (e) {
    console.warn(LOG_PREFIX, 'attendee emails error:', e);
  }

  
  try {
    const dateField = data.date || data.dueDate || data.startDate || data.departureDate || null;
    if (dateField && botDef.autoEmail) {
      const reminderRecipients = botType === 'task'
        ? getUniqueEmails(userEmail, taskRecipients)
        : getUniqueEmails(userEmail);

      for (const recipientEmail of reminderRecipients) {
        await emailService.scheduleReminder(recipientEmail, saved._id, botType, data).catch(e => {
          console.warn(LOG_PREFIX, 'scheduleReminder failed:', recipientEmail, e?.message || e);
        });
      }
      resp += `\nReminder scheduled.`;
    }
  } catch (e) {
    console.warn(LOG_PREFIX, 'reminder scheduling error:', e);
  }

  return resp;
}


async function executeDirect(userOrObj, botType, data, sendEmail = false) {
  const botDef = botDefinitions[botType];
  if (!botDef) throw new Error('Unknown botType: ' + botType);

  const userEmail = (userOrObj && userOrObj.email) || (typeof userOrObj === 'string' ? userOrObj : null);
  const taskRecipients = botType === 'task' ? getTaskRecipients(data) : [];

  normalizeBotAliases(botType, data);

 
  try {
    for (const key of Object.keys(data || {})) {
      if (isDateLikeKey(key)) {
        if (typeof data[key] === 'string' && !data[key].includes('T')) {
          const d = await parseNaturalDateTime(String(data[key]));
          if (d) data[key] = d.toISOString();
        }
      }
      if (isTimeLikeKey(key) && typeof data[key] === 'string') {
        const t = parseTimeShort(String(data[key]));
        if (t) data[key] = t;
      }
    }
  } catch (e) {
    console.warn(LOG_PREFIX, 'normalization error:', e?.message || e);
  }

  const dateKeys = ['date','startDate','dueDate','departureDate'];
  for (const key of dateKeys) {
    if (data[key] && typeof data[key] === 'string' && data[key].includes('T')) {
      if (!data.time) data.time = extractTimeFromISO(data[key]);
    }
  }

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

  let resp = ` ${ (botDef.name || botType).toUpperCase() } CREATED!\n\n`;
  resp += generateSummary(data);
  resp += `\nMeeting ID: ${saved._id}`;

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
          resp += `\n Meeting link: ${meeting.joinUrl}`;
          data.joinUrl = meeting.joinUrl;
          data.startUrl = meeting.startUrl || null;
          try { await crudService.updateById(saved._id, userEmail, { meeting, joinUrl: meeting.joinUrl, startUrl: meeting.startUrl, startISO: data.startISO || null }); } catch(e){ }
        } catch (err) {
          console.warn(LOG_PREFIX, 'createZoomMeeting failed:', err?.message || err);
          resp += `\n Meeting creation failed (external).`;
        }
      }
    } catch (e) {
      console.warn(LOG_PREFIX, 'meeting handling error:', e);
    }
  }

  try {
    if (userEmail && (sendEmail || botDef.autoEmail || botDef.emailRequired)) {
      await emailService.sendConfirmation(userEmail, botType, data).catch(err => {
        console.warn(LOG_PREFIX,'sendConfirmation owner failed:', err?.message || err);
      });
      resp += `\n\n Email sent to ${userEmail}`;
    }
  } catch (e) {
    console.warn(LOG_PREFIX,'owner email error:', e);
  }

  
  try {
    if (botType === 'task' && taskRecipients.length) {
      for (const em of taskRecipients) {
        if (em === String(userEmail || '').trim().toLowerCase()) continue;
        try { await emailService.sendConfirmation(em, botType, data); } catch(e){ console.warn(LOG_PREFIX,'task recipient email fail:', em, e?.message || e); }
      }
      resp += `\nTask assignee emails queued/sent.`;
    }

    if (data.attendees && (botType === 'meeting' || botType === 'interview')) {
      const attendees = Array.isArray(data.attendees) ? data.attendees : String(data.attendees).split(',').map(x=>x.trim()).filter(Boolean);
      for (const em of attendees) {
        try { await emailService.sendConfirmation(em, botType, data); } catch(e){ console.warn(LOG_PREFIX,'attendee email fail:', em, e?.message || e); }
      }
      resp += `\nAttendee emails queued/sent.`;
    }
    if (data.interviewers && botType === 'interview') {
      const ints = Array.isArray(data.interviewers) ? data.interviewers : String(data.interviewers).split(',').map(x=>x.trim()).filter(Boolean);
      for (const em of ints) {
        try { await emailService.sendConfirmation(em, botType, data); } catch(e){ console.warn(LOG_PREFIX,'interviewer email fail:', em, e?.message || e); }
      }
    }
  } catch (e) { console.warn(LOG_PREFIX,'attendees handling error:', e); }

 
  try {
    const dateField = data.date || data.dueDate || data.startDate || data.departureDate;
    if (dateField && botDef.autoEmail) {
      const reminderRecipients = botType === 'task'
        ? getUniqueEmails(userEmail, taskRecipients)
        : getUniqueEmails(userEmail);

      for (const recipientEmail of reminderRecipients) {
        await emailService.scheduleReminder(recipientEmail, saved._id, botType, data).catch(e => {
          console.warn(LOG_PREFIX,'scheduleReminder failed:', recipientEmail, e?.message || e);
        });
      }
      resp += `\nReminder scheduled.`;
    }
  } catch (e) { console.warn(LOG_PREFIX,'reminder schedule error:', e); }

  
  return resp;
}

function generateSummary(data) {
  let out = '';
  for (const [k,v] of Object.entries(data || {})) {
    if (v === undefined || v === null || v === '') continue;
    const key = k.charAt(0).toUpperCase() + k.slice(1);
    const value = Array.isArray(v) ? v.join(', ') : v;
    out += ` ${ key }: ${ value }\n`;
  }
  return out;
}

module.exports = {
  process,
  executeDirect,
  parseNaturalDateTime
};
