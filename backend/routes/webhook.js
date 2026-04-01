require('dotenv').config();
const express = require('express');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const BotData = require('../models/BotData');
const { callGemini } = require('../config/gemini');
const redisModule = require('../config/redis');
const conversationEngine = require('../services/conversationEngine');
const crudService = require('../services/crudService');
const calendarService = require('../services/calendarService');
const emailService = require('../services/emailService');
const botDefinitions = require('../services/botDefinitions');
const { getWeather, getNews, getMarketData } = require('../services/externalAPIs');
const { getGreeting } = require('../utils/greetings');
const { extractEmailFromText } = require('../utils/validators');
const recordViewService = require('../services/recordViewService');

const router = express.Router();
const LOG = '[webhook]';


async function ensureRedis() {
  try {
    if (!redisModule) return null;
    if (typeof redisModule === 'function') return await redisModule();
    if (redisModule && typeof redisModule.createRedisClient === 'function') {
      return await redisModule.createRedisClient();
    }
    return redisModule;
  } catch (err) {
    console.warn(`${LOG} ensureRedis fallback used:`, err?.message || err);
    return null;
  }
}

function safeJsonExtract(text) {
  if (!text || typeof text !== 'string') return null;
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) {
      const candidate = text.slice(start, i + 1);
      try { return JSON.parse(candidate); } catch (e) { return null; }
    }
  }
  return null;
}

function deriveSessionId(raw, req) {
  if (raw && raw.email) return String(raw.email).trim().toLowerCase();
  if (raw && raw.user) {
    const u = raw.user;
    if (u.email) return String(u.email).trim().toLowerCase();
    if (u.id) return `uid:${String(u.id)}`;
    if (u.username) return `user:${String(u.username)}`;
    if (u.name) return `name:${String(u.name)}`;
  }
  if (req && req.ip) return `ip:${req.ip}`;
  return `anon:${Date.now()}`;
}

function wantsEmail(userMessage, explicitFlag) {
  if (explicitFlag === true) return true;
  if (explicitFlag === false) return false;
  const s = (userMessage || '').toLowerCase();
  return /\b(email|mail|send email|email it|mail it|send me)\b/.test(s);
}

function normalizeEmailList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  return Array.from(new Set(
    items
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
  ));
}

function looksLikeFreshCommand(userMessage) {
  const msg = String(userMessage || '').trim().toLowerCase();
  return /^(create|add|schedule|set|show|list|view|delete|update|book|plan)\b/.test(msg) ||
    /\b(task|meeting|reminder|interview|travel|weather|news|crypto|market)\b/.test(msg);
}

function findPriority(text) {
  const match = String(text || '').match(/\b(low|medium|high)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function extractTaskTitle(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  const patterns = [
    /\btask called\s+(.+?)(?=\s+(?:due|by|on|tomorrow|today|next|with priority|priority)\b|$)/i,
    /\badd task\s+(.+?)(?=\s+(?:due|by|on|tomorrow|today|next|with priority|priority)\b|$)/i,
    /\bcreate(?:\s+a)?(?:\s+\w+)?\s+task(?:\s+called)?\s+(.+?)(?=\s+(?:due|by|on|tomorrow|today|next|with priority|priority)\b|$)/i,
    /\btask\s+(.+?)(?=\s+(?:due|by|on|tomorrow|today|next|with priority|priority)\b|$)/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractMeetingTitle(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  const aboutMatch = raw.match(/\babout\s+(.+?)(?=\s+for\s+\d+\s*(?:minutes|minute|min|mins)\b|$)/i);
  if (aboutMatch) return aboutMatch[1].trim();
  const titleMatch = raw.match(/\bmeeting(?:\s+about|\s+called)?\s+(.+?)(?=\s+(?:tomorrow|today|next|on|at|with|for)\b|$)/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

function extractQuotedOrEmailStrippedDatePhrase(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  const patterns = [
    /\bdue\s+(.+?)(?=\s+(?:with priority|priority|email it|send email|mail it|assign(?:ed)? to|for [^0-9]|$))/i,
    /\bon\s+(.+?)(?=\s+(?:with priority|priority|email it|send email|mail it|assign(?:ed)? to|with [^\d]|about|for [^0-9]|$))/i,
    /\b(?:today|tomorrow)\b(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
    /\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
    /\b(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2}(?:,\s*|\s+)\d{4}(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
    /\b\d{4}-\d{1,2}-\d{1,2}(?:\s+\d{1,2}:\d{2}(?:\s*(?:am|pm))?)?/i,
    /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{4}(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[0].replace(/^(due|on)\s+/i, '').trim();
  }
  return null;
}

async function applyRuleBasedExtraction(botType, userMessage, extractedData) {
  const nextData = { ...(extractedData || {}) };
  const emails = normalizeEmailList(userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) || []);

  if (botType === 'task') {
    if (!nextData.title) nextData.title = extractTaskTitle(userMessage);
    if (!nextData.priority) nextData.priority = findPriority(userMessage);
    if (!nextData.assignees && emails.length) nextData.assignees = emails;
    const duePhrase = extractQuotedOrEmailStrippedDatePhrase(userMessage);
    if (duePhrase && !nextData.dueDate) {
      const parsed = await conversationEngine.parseNaturalDateTime(duePhrase);
      if (parsed instanceof Date && !isNaN(parsed.getTime())) nextData.dueDate = parsed.toISOString();
    }
  }

  if (botType === 'meeting') {
    if (!nextData.title) nextData.title = extractMeetingTitle(userMessage) || 'Meeting';
    if (!nextData.attendees && emails.length) nextData.attendees = emails.join(',');
    if (!nextData.duration) {
      const durationMatch = userMessage.match(/for\s+(\d{1,4})\s*(minutes|minute|min|mins)\b/i);
      if (durationMatch) nextData.duration = parseInt(durationMatch[1], 10);
    }
    const whenPhrase = extractQuotedOrEmailStrippedDatePhrase(userMessage);
    if (whenPhrase && !nextData.date) {
      const parsed = await conversationEngine.parseNaturalDateTime(whenPhrase);
      if (parsed instanceof Date && !isNaN(parsed.getTime())) nextData.date = parsed.toISOString();
    }
  }

  return nextData;
}

const KEYBANK = {
  meeting: ['schedule meeting','meeting with','arrange meeting','book meeting','team sync','standup','zoom','google meet','zoho meeting'],
  task: ['create task','add task','todo','to-do','finish project','complete work','assign task'],
  reminder: ['remind me','set reminder','alert me','notify me','remember to'],
  travel: ['book flight','book travel','travel plan','trip to','hotel booking'],
  interview: ['schedule interview','interview with','candidate interview'],
  weather: ['weather','temperature','forecast'],
  news: ['news','headlines','top stories'],
  crypto: ['bitcoin','btc','ethereum','eth','dogecoin','doge'],
  market: ['stock price','market','nifty','sensex','aapl','msft','googl'],
  coding: ['leetcode','write code','explain code','algorithm'],
  business: ['business insight','market research','analysis'],
  recordview: ['show','list','view','fetch','retrieve']
};

async function detectBot(userMessage) {
  const msg = (userMessage || '').toString().toLowerCase().trim();
  if (!msg) return 'chat';

  if (
       /^\s*(show|list|view|fetch|retrieve)\b/.test(msg) ||
       msg.includes('show my') ||
       msg.includes('show all') ||
       msg.startsWith('delete ') ||
       msg.startsWith('update ')
  ) {
    return 'recordview';
  }

  for (const [bot, keys] of Object.entries(KEYBANK)) {
    for (const w of keys) {
      if (msg.includes(w)) return bot;
    }
  }

  if (/\btask\b/.test(msg)) return 'task';
  if (/\bmeeting\b/.test(msg)) return 'meeting';
  if (/\bremind(?: me)?\b|\breminder\b/.test(msg)) return 'reminder';
  if (/\binterview\b/.test(msg)) return 'interview';
  if (/\btravel\b|\btrip\b|\bflight\b/.test(msg)) return 'travel';

  try {
    const prompt = `
Classify into a single bot name from:
task, meeting, travel, reminder, interview, weather, news,
crypto, market, business, coding, recordview, chat

Return only the single word bot name.
User message: """${userMessage}"""
`;
    const r = await callGemini(prompt);
    const txt = typeof r === 'string' ? r : (r && (r.text || JSON.stringify(r))) || '';
    const m = txt.match(/\b(task|meeting|travel|reminder|interview|weather|news|crypto|market|business|coding|recordview|chat)\b/i);
    if (m) return m[1].toLowerCase();
  } catch (err) {
    console.warn(`${LOG} Gemini classify failed:`, err?.message || err);
  }

  return 'chat';
}

function formatRecords(items) {
  return (items || []).map(it => {
    const id = it._id || it.id || 'id?';
    const email = it.email || it.ownerEmail || it.owner || 'owner?';
    const title = (it.data && (it.data.title || it.data.name)) || (it.title || it.name) || '[no title]';
    const when = (it.data && (it.data.date || it.data.dueDate || it.data.startDate)) || it.scheduledDate || '';
    return `• ${title} (id: ${id}) — owner: ${email}${when ? ` — when: ${when}` : ''}`;
  }).join('\n');
}

router.post('/', async (req, res) => {
  try {
    const raw = req.body || {};
    const userMessage = (raw.text || raw.message || raw.textRaw || '').toString().trim();
    const incomingEmail = raw.email ? String(raw.email).trim() : (raw.user && raw.user.email ? String(raw.user.email).trim() : '');
    const emailInText = extractEmailFromText(userMessage);
    const sessionId = deriveSessionId(raw, req);
    const userEmail = incomingEmail || (raw.user && raw.user.email) || emailInText || null;

    if (userMessage && userMessage.startsWith('/help')) {
      return res.json({
        text: `AI \n\n/ai <question> — Ask Gemini\n/help — this menu\n\nExamples:\n- "create a task finish report tomorrow at 5pm email it"\n- "schedule meeting tomorrow 3pm with a@b.com about review for 30 minutes"\n- "show all tasks"\n- "delete meeting id 64b..."\n- "delete all meetings confirm"`
      });
    }
    if (userMessage && userMessage.startsWith('/ai')) {
      const q = userMessage.replace('/ai', '').trim() || 'Hello';
      try {
        const r = await callGemini(q);
        const ans = typeof r === 'string' ? r : (r.text || JSON.stringify(r));
        return res.json({ text: ` Gemini response:\n\n${ans}` });
      } catch (err) {
        return res.json({ text: 'Gemini error' });
      }
    }

    console.log(`${LOG} Incoming:`, userMessage, `(session:${sessionId} email:${userEmail || 'none'})`);
    if (!userMessage) return res.json({ text: 'Please send a message.' });

    const lc = userMessage.trim().toLowerCase();
    if (['hi','hello','hey','hola'].includes(lc)) {
      return res.json({ text: `${getGreeting()}\n\nI can help with tasks, meetings, travel, reminders, and more.` });
    }

    let user = null;
    if (userEmail) {
      user = await User.findOne({ email: userEmail.toLowerCase() }).catch(()=>null);
      if (!user) {
        try { user = new User({ email: userEmail.toLowerCase() }); await user.save(); } catch(e) {  }
      }
    } else if (raw.user && (raw.user.username || raw.user.id)) {
      const key = raw.user.email || raw.user.username || raw.user.id;
      if (key) user = await User.findOne({ $or: [{ username: key }, { externalId: key }, { email: key }] }).catch(()=>null);
    }

    const redis = await ensureRedis();
    let activeConversation = null;
    try {
      activeConversation = await Conversation.findOne({ userId: sessionId, status: 'active' }).catch(()=>null);
    } catch (e) { activeConversation = null; }

    if (activeConversation) {
      try {
        if (looksLikeFreshCommand(userMessage) && /\b(create|add|schedule|set|show|list|view|delete|update|book|plan)\b/i.test(userMessage)) {
          activeConversation.status = 'cancelled';
          await activeConversation.save().catch(()=>{});
          activeConversation = null;
        }
      } catch (err) {
        console.warn(`${LOG} active conversation reset failed:`, err?.message || err);
      }
    }

    if (activeConversation) {
      try {
        const reply = await conversationEngine.process(activeConversation, userMessage, { user, redis });
        return res.json({ text: reply });
      } catch (err) {
        console.warn(`${LOG} conversation engine error:`, err?.message || err);
      }
    }

    const botType = await detectBot(userMessage);
    console.log(`${LOG} Detected bot:`, botType);

    if (botType === 'recordview') {
      try {
        const rv = await recordViewService.handleRecordView(raw, userMessage, sessionId, userEmail);
        return res.json({ text: rv });
      } catch (err) {
        console.error(`${LOG} recordViewService error:`, err?.message || err);
        return res.json({ text: ' Failed to process record command.' });
      }
    }

    if (botType === 'weather') {
      const loc = (raw.location || raw.city || (userMessage.match(/in\s+([A-Za-z\s]+)/i) && userMessage.match(/in\s+([A-Za-z\s]+)/i)[1]) || 'Mumbai').trim();
      try {
        const w = await getWeather(loc);
        let out = `Weather for ${w.city || loc}\n\nTemperature: ${w.temp}°C\nCondition: ${w.condition}\nHumidity: ${w.humidity}%`;
        if (wantsEmail(userMessage, raw.sendEmail)) {
          if (!userEmail) out += '\n\n I need your email to send this. Please provide your email.';
          else {
            await emailService.sendPlainText(userEmail, `Weather for ${loc}`, out);
            out += `\n\nEmail sent to ${userEmail}`;
          }
        }
        return res.json({ text: out });
      } catch (err) {
        console.error(`${LOG} Weather error`, err);
        return res.json({ text: ' Could not fetch weather right now.' });
      }
    }

    if (botType === 'news') {
      const topic = raw.topic || (userMessage.match(/news about ([\w\s]+)/i) && userMessage.match(/news about ([\w\s]+)/i)[1]) || 'technology';
      try {
        const items = await getNews(topic);
        let out = `Top News - ${topic}\n\n`;
        (items || []).slice(0,5).forEach((i, idx) => {
          out += `${idx+1}. ${i.title || i}\n`;
          if (i.url) out += `${i.url}\n`;
        });
        if (wantsEmail(userMessage, raw.sendEmail)) {
          if (!userEmail) out += '\n\nI need your email to send this.';
          else {
            await emailService.sendPlainText(userEmail, `Top News - ${topic}`, out);
            out += `\n\nEmail sent to ${userEmail}`;
          }
        }
        return res.json({ text: out });
      } catch (err) {
        console.error(`${LOG} News error`, err);
        return res.json({ text: 'Could not fetch news.' });
      }
    }

    if (botType === 'crypto' || botType === 'market') {
      try {
        let coin = 'bitcoin';
        const coinMatch = userMessage.match(/\b(bitcoin|btc|ethereum|eth|dogecoin|doge|litecoin|ltc|nifty|sensex|aapl|googl|msft|tsla)\b/i);
        if (coinMatch) coin = coinMatch[1].toLowerCase();
        const mdata = await getMarketData(coin);
        let out = `${coin.toUpperCase()} Market Data\n\nUSD: $${mdata.usd ?? 'N/A'}`;
        if (mdata.inr) out += `\nINR: ₹${mdata.inr}`;
        if (mdata.usd_24h_change) out += `\n24h: ${mdata.usd_24h_change}%`;
        if (wantsEmail(userMessage, raw.sendEmail)) {
          if (!userEmail) out += `\n\nI need your email to send this.`;
          else {
            await emailService.sendPlainText(userEmail, `${coin.toUpperCase()} Market Data`, out);
            out += `\n\n Email sent to ${userEmail}`;
          }
        }
        return res.json({ text: out });
      } catch (err) {
        console.error(`${LOG} Market/crypto error`, err);
        return res.json({ text: ' Could not fetch market data.' });
      }
    }

    if (botType === 'coding') {
      try {
        const prompt = `You are a coding assistant. Answer user concisely:\n\n${userMessage}`;
        const r = await callGemini(prompt);
        const txt = typeof r === 'string' ? r : (r.text || JSON.stringify(r));
        let out = ` Coding Answer\n\n${txt}`;
        if (wantsEmail(userMessage, raw.sendEmail)) {
          if (!userEmail) out += '\n\n I need your email to send this.';
          else {
            await emailService.sendPlainText(userEmail, 'Coding Answer', out);
            out += `\n\n Email sent to ${userEmail}`;
          }
        }
        return res.json({ text: out });
      } catch (err) {
        console.error(`${LOG} Coding error`, err);
        return res.json({ text: ' Could not generate code.' });
      }
    }

    if (botType === 'business') {
      try {
        const prompt = `Business analyst: ${userMessage}`;
        const r = await callGemini(prompt);
        const txt = typeof r === 'string' ? r : (r.text || JSON.stringify(r));
        let out = `Business Insights\n\n${txt}`;
        if (wantsEmail(userMessage, raw.sendEmail)) {
          if (!userEmail) out += '\n\n I need your email to send this.';
          else {
            await emailService.sendPlainText(userEmail, 'Business Insights', out);
            out += `\n\n Email sent to ${userEmail}`;
          }
        }
        return res.json({ text: out });
      } catch (err) {
        console.error(`${LOG} Business error`, err);
        return res.json({ text: ' Could not generate business insights.' });
      }
    }

    const botDef = botDefinitions[botType] || botDefinitions['task'];
    const fields = (botDef && botDef.fields) ? botDef.fields : [];

    let extractPrompt = `Extract fields for bot "${botType}" from the user message.\nReturn only a JSON object with "data":{...} and "sendEmail":true/false.\nFields:\n`;
    for (const f of fields) extractPrompt += `- ${f.name} (${f.type || 'text'})\n`;
    extractPrompt += `\nUser message: """${userMessage}"""\nReturn JSON only. Example:\n{"data":{"title":"...","date":"2025-10-10","time":"10:00","attendees":"a@b.com,b@c.com"},"sendEmail":true}\n`;

    let extraction = null;
    try {
      const ai = await callGemini(extractPrompt);
      const txt = typeof ai === 'string' ? ai : (ai && (ai.text || JSON.stringify(ai)));
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) extraction = JSON.parse(m[0]);
    } catch (err) {
      console.warn(`${LOG} Extraction via Gemini failed:`, err?.message || err);
    }

    let extractedData = (extraction && extraction.data) ? extraction.data : {};
    const sendEmailFlag = (extraction && typeof extraction.sendEmail === 'boolean') ? extraction.sendEmail : wantsEmail(userMessage, raw.sendEmail);

    extractedData = await applyRuleBasedExtraction(botType, userMessage, extractedData);

    if (!extractedData.title && /titled\s+["']?([^,"']{3,200})/i.test(userMessage)) {
      extractedData.title = userMessage.match(/titled\s+["']?([^,"']{3,200})/i)[1].trim();
    } else if (!extractedData.title && /called\s+["']?([^,"']{3,200})/i.test(userMessage)) {
      extractedData.title = userMessage.match(/called\s+["']?([^,"']{3,200})/i)[1].trim();
    } else if (!extractedData.title && /"(.*?)"/.test(userMessage)) {
      extractedData.title = userMessage.match(/"(.*?)"/)[1];
    } else if (!extractedData.title && botType === 'task') {
      const t = userMessage.match(/task(?:\s+called)?\s+(.{3,200})/i);
      if (t) extractedData.title = t[1].split(/\sat\b|\btomorrow\b|\bfor\b/)[0].trim();
    }

  
    if (botType === 'task') {
      const emailsFound = normalizeEmailList(userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) || []);
      if (emailsFound.length) {
        extractedData.assignees = extractedData.assignees || emailsFound;
        extractedData.emails = emailsFound;
      }
    }
    if ((botType === 'meeting' || botType === 'interview') && !extractedData.attendees) {
      const emails = normalizeEmailList(userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) || []);
      if (emails.length) extractedData.attendees = emails.join(',');
    }
    if (!extractedData.duration) {
      const dur = userMessage.match(/for\s+(\d{1,4})\s*(minutes|minute|min|mins)/i) || userMessage.match(/(\d{1,4})\s*(minutes|min|mins)/i);
      if (dur) extractedData.duration = parseInt(dur[1],10);
    }

    
    try {
      const dateSource = extractQuotedOrEmailStrippedDatePhrase(userMessage) || userMessage;
      const pd = await conversationEngine.parseNaturalDateTime(dateSource);
      if (pd instanceof Date && !isNaN(pd.getTime())) {
        
        const y = pd.getFullYear();
        const m = String(pd.getMonth() + 1).padStart(2, '0');
        const d = String(pd.getDate()).padStart(2, '0');
        const hh = String(pd.getHours()).padStart(2, '0');
        const mm = String(pd.getMinutes()).padStart(2, '0');
        extractedData.date = `${y}-${m}-${d}`;      
        extractedData.time = `${hh}:${mm}`;        
      } else {
        const timeOnly = userMessage.match(/\b(\d{1,2}(?::\d{2})?\s*(am|pm)?)\b/i);
        if (timeOnly && !extractedData.time) {
          const tStr = timeOnly[1];
          const tParsed = await conversationEngine.parseNaturalDateTime(tStr);
          if (tParsed instanceof Date && !isNaN(tParsed.getTime())) {
            extractedData.time = `${String(tParsed.getHours()).padStart(2,'0')}:${String(tParsed.getMinutes()).padStart(2,'0')}`;
          }
        }
      }
    } catch (err) {
      console.warn(`${LOG} date parsing fallback:`, err?.message || err);
    }

    if (botType === 'task' && extractedData.date && !extractedData.dueDate) {
      if (extractedData.time) {
        extractedData.dueDate = `${extractedData.date}T${extractedData.time}:00`; 
      } else {
        extractedData.dueDate = `${extractedData.date}`;
      }
    }

    const ownerEmail = userEmail || (extractedData.email || (extractedData.attendees && extractedData.attendees.split && extractedData.attendees.split(',')[0])) || null;

    const hasAttendees = !!(extractedData.attendees && extractedData.attendees.length);
    const hasTeammates = !!(extractedData.emails && extractedData.emails.length);
    const hasAnyEmail = Boolean(userEmail || extractedData.email || hasAttendees || hasTeammates);
    if (botDef && botDef.emailRequired && !hasAnyEmail) {
      const conv = new Conversation({
        userId: sessionId,
        email: userEmail || null,
        botType,
        status: 'active',
        currentStep: 0,
        collectedData: extractedData
      });
      await conv.save();
      return res.json({ text: 'I need your email to complete this action. Please provide your email.' });
    }

    const payloadForCreate = { ...extractedData };
    const requiredMissing = [];
    for (const f of fields || []) {
      if (f.required) {
        const v = payloadForCreate[f.name];
        if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) requiredMissing.push(f.name);
      }
    }
    if (requiredMissing.length > 0) {
      const firstMissing = requiredMissing[0];
      const meta = (fields || []).find(x => x.name === firstMissing);
      const question = meta ? meta.question : `Please provide ${firstMissing}`;
      const currentStep = Math.max(0, (fields || []).findIndex(x => x.name === firstMissing));
      const conv = new Conversation({
        userId: sessionId,
        email: userEmail || null,
        botType,
        status: 'active',
        currentStep,
        collectedData: payloadForCreate
      });
      await conv.save();
      return res.json({ text: `I need a few more details to create the ${botDef?.name || botType}:\n\nMissing: ${requiredMissing.join(', ')}\n\n${question}\n\n(Reply with the answer. Type "step-by-step" to answer all fields one by one.)` });
    }

    try {
      const userObjForExec = user || { email: ownerEmail };
      const result = await conversationEngine.executeDirect(userObjForExec, botType, payloadForCreate, sendEmailFlag);
      const textResp = (typeof result === 'string') ? result : (result && (result.text || JSON.stringify(result))) || 'Done';

      return res.json({ text: textResp });
    } catch (err) {
      console.error(`${LOG} Create/direct execution error:`, err?.stack || err);
      return res.json({ text: 'Internal error while creating record.' });
    }

  } catch (err) {
    console.error(`${LOG} top-level error:`, err?.stack || err);
    return res.json({ text: 'Internal error.' });
  }
});

module.exports = router;
