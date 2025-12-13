// services/recordViewService.js
'use strict';

const crudService = require('./crudService');

/* ----------------------------------------------------
   Helpers
---------------------------------------------------- */

function safeJsonExtract(txt) {
  if (!txt || typeof txt !== 'string') return null;
  const start = txt.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < txt.length; i++) {
    const ch = txt[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) {
      const cand = txt.slice(start, i + 1);
      try { return JSON.parse(cand); } catch (e) { return null; }
    }
  }
  return null;
}

function sanitizeIdCandidate(s) {
  if (!s) return null;
  const m = String(s).match(/([0-9a-fA-F]{6,64})/);
  return m ? m[1] : null;
}

function formatRecords(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return items.map(it => {
    const id = it._id || it.id || 'id?';
    const email = it.email || it.ownerEmail || 'owner?';
    const title =
      (it.data && (it.data.title || it.data.name)) ||
      it.title ||
      it.name ||
      '[no title]';

    const when =
      (it.data && (it.data.date || it.data.dueDate || it.data.startDate)) ||
      it.scheduledDate ||
      '';

    return `• ${title} (id: ${id}) — owner: ${email}${when ? ` — when: ${when}` : ''}`;
  }).join('\n');
}

/* ----------------------------------------------------
   fuzzyFind using crudService.list
---------------------------------------------------- */
async function fuzzyFind({ botType = null, userEmail = null, text = '', limit = 200 }) {
  const items = await crudService
    .list({
      botType,
      userEmail,
      limit: Math.min(limit, 500),
      lean: true
    })
    .catch(() => []);

  const q = text.toLowerCase().trim();
  if (!q) return items;

  return items.filter(c => {
    const title =
      (c.data && (c.data.title || c.data.name)) ||
      c.title ||
      c.name ||
      '';
    const when =
      (c.data && (c.data.date || c.data.startDate || c.data.dueDate)) ||
      '';
    return (
      String(title).toLowerCase().includes(q) ||
      String(when).toLowerCase().includes(q) ||
      JSON.stringify(c.data || '').toLowerCase().includes(q)
    );
  });
}

/* ----------------------------------------------------
   Main Handler
---------------------------------------------------- */
async function handleRecordView(raw, userMessage, sessionId, userEmail) {
  const msg = (userMessage || '').trim();
  const lower = msg.toLowerCase();

  if (!msg) return 'Tell me what to do: "show all", "delete id <id>", etc.';

  /* ---------------- DELETE ALL ---------------- */
  if (/\bdelete all\b/i.test(lower)) {
    if (!userEmail) return 'I need your email to delete your records.';

    if (!/\bconfirm\b/i.test(lower)) {
      return '⚠️ Confirm delete: say "delete all confirm"';
    }

    const which = lower.match(
      /\bdelete all\s+(meetings|tasks|reminders|interviews|travel|records|all)\b/i
    );
    const map = {
      meetings: 'meeting',
      tasks: 'task',
      reminders: 'reminder',
      interviews: 'interview',
      travel: 'travel'
    };
    const botType = which ? map[which[1]] || which[1] : null;

    try {
      const filter = botType
        ? { botType, email: userEmail }
        : { email: userEmail };

      const r = await crudService.deleteMany(filter).catch(() => null);
      if (!r) return 'No matching records to delete.';
      return botType
        ? `All ${botType} records deleted.`
        : `All your records deleted.`;
    } catch (err) {
      console.error('[recordView] deleteAll', err);
      return 'Server error deleting records.';
    }
  }

  /* ---------------- DELETE BY ID ---------------- */
  const delId = lower.match(
    /\bdelete\s+(?:[a-z]+\s+)?id\s*[:=]?\s*([0-9a-fA-F]{6,64})/i
  );
  if (delId) {
    if (!userEmail) return 'I need your email to delete a record.';
    const id = sanitizeIdCandidate(delId[1]);
    try {
      const ok = await crudService.softDeleteById(id, userEmail);
      return ok
        ? `✅ Deleted record ${id}`
        : `Record ${id} not found or not permitted.`;
    } catch (err) {
      console.error('[recordView] delete id error', err);
      return 'Server error deleting record.';
    }
  }

  /* ---------------- NATURAL DELETE ---------------- */
  if (
    /^delete\s+(my|the)\s+(meeting|task|reminder|interview|travel)/i.test(lower) &&
    !/id\s+/i.test(lower)
  ) {
    if (!userEmail) return 'I need your email to delete a record.';

    const botMatch = lower.match(
      /\b(meeting|task|reminder|interview|travel)\b/
    );
    const botType = botMatch ? botMatch[1] : null;
    const query = msg.replace(/^delete\s+(my|the)\s+/i, '').trim();

    const matches = await fuzzyFind({ botType, userEmail, text: query });
    if (!matches.length)
      return `No ${botType} matched "${query}".`;

    if (matches.length === 1) {
      const id = matches[0]._id || matches[0].id;
      const ok = await crudService.softDeleteById(id, userEmail);
      return ok ? `✅ Deleted ${botType} ${id}` : `Cannot delete ${id}.`;
    }

    return (
      'Multiple matches found. Delete by id:\n' +
      matches
        .map(
          m =>
            `• ${(m.data && (m.data.title || m.data.name)) || m.title} (id: ${
              m._id || m.id
            })`
        )
        .join('\n')
    );
  }

  /* ---------------- UPDATE BY ID ---------------- */
  if (/^update\b/i.test(lower)) {
    if (!userEmail) return 'I need your email to update records.';

    const idMatch = lower.match(
      /id\s*[:=]?\s*([0-9a-fA-F]{6,64})/
    );
    if (idMatch) {
      const id = sanitizeIdCandidate(idMatch[1]);
      const updates = {};

      const title = msg.match(
        /(?:title|name)\s*(?:to|=)\s*["']?([^"']+)["']?/i
      );
      if (title) updates['data.title'] = title[1].trim();

      const date = msg.match(
        /\b(date|due date|on)\s*(?:to|=)?\s*([0-9\-\/]{6,})/i
      );
      if (date) updates['data.date'] = date[2].trim();

      const time = msg.match(
        /\btime\s*(?:to|=)\s*([0-9:apm\s]+)/i
      );
      if (time) updates['data.time'] = time[1].trim();

      if (!Object.keys(updates).length)
        return 'No fields detected to update. Example: update meeting id <id> title to Something';

      try {
        const ok = await crudService.updateById(id, userEmail, updates);
        return ok ? `✅ Updated ${id}` : `Update failed for ${id}`;
      } catch (err) {
        console.error('[recordView] update error', err);
        return 'Server error updating record.';
      }
    }

    // natural update → need id
    const botMatch = lower.match(
      /\b(meeting|task|reminder|interview|travel)\b/
    );
    const botType = botMatch ? botMatch[1] : null;
    const query = msg
      .replace(/^update\s+/i, '')
      .replace(/\s*(title|time|date|set).*/i, '')
      .trim();

    const matches = await fuzzyFind({ botType, userEmail, text: query });
    if (!matches.length)
      return `No ${botType} matched "${query}".`;

    if (matches.length > 1)
      return (
        'Multiple matches. Update using ID:\n' +
        matches
          .map(
            m =>
              `• ${(m.data && (m.data.title || m.data.name)) ||
                m.title} (id: ${m._id || m.id})`
          )
          .join('\n')
      );

    return `Please specify id: update ${botType} id ${
      matches[0]._id || matches[0].id
    } title to ...`;
  }

  /* ---------------- LIST / SHOW ---------------- */
  const list = lower.match(
    /\b(show|list|view)\s+(all\s+)?(meetings|tasks|reminders|interviews|travel)?\b/
  );
  if (list) {
    const word = list[3];
    const map = {
      meetings: 'meeting',
      tasks: 'task',
      reminders: 'reminder',
      interviews: 'interview',
      travel: 'travel'
    };
    const botType = word ? map[word] || word : null;

    try {
      const items = await crudService.list({
        botType,
        userEmail,
        limit: 300,
        lean: true
      });

      if (!items.length)
        return botType
          ? `No ${botType} records found.`
          : 'No records found.';

      return formatRecords(items);
    } catch (err) {
      console.error('[recordView] list error', err);
      return 'Server error listing records.';
    }
  }

  /* ---------------- HELP ---------------- */
  return `Record commands:
• show all
• show all meetings
• delete meeting id <id>
• delete my meeting about <text>
• delete all meetings confirm
• update meeting id <id> title to "..."
`;
}

/* ---------------------------------------------------- */
module.exports = {
  handleRecordView,
  fuzzyFind,
  formatRecords,
  safeJsonExtract
};
