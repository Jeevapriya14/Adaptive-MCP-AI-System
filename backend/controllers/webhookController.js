
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { callGemini } = require('../config/gemini');
const { createRedisClient } = require('../config/redis');
const conversationEngine = require('../../services/conversationEngine');
const crudService = require('../../services/crudService');
const { getGreeting } = require('../utils/greetings');
const { validateEmail, extractEmailFromText } = require('../utils/validators');
const botDefinitions = require('../../services/botDefinitions');
const { getWeather, getNews, getMarketData } = require('../../services/externalAPIs');
const emailService = require('../../services/emailService');

module.exports = async (req, res) => {
  try {
    const userMessage = (req.body?.text || '').trim();
    const incomingEmail = (req.body?.email || req.body?.user?.email || '').toString().trim();
    const userEmailFromText = extractEmailFromText(userMessage);
    const userEmail = incomingEmail || userEmailFromText || null;

    if (!userMessage) {
      return res.json({ text: 'Please send a message.' });
    }

    console.log(`\nIncoming message: ${userMessage} (email: ${userEmail || 'none'})`);
    const lc = userMessage.toLowerCase();
    if (['hi', 'hello', 'hey', 'hola'].includes(lc)) {
      const greeting = getGreeting();
      return res.json({
        text: `${greeting}\n\nI'm your AI assistant powered by Gemini. I can help with:\n\n` +
              `Task Manager\nMeeting Scheduler (with Zoho link)\nTravel Planner\n` +
              `Reminder Bot\nInterview Scheduler\nWeather Bot\nNews Bot\n` +
              `Crypto Bot\nMarket Bot\nBusiness Insights\nCoding Bot\nChat Bot\n\n` +
              `Just tell me what you need! `
      });
    }
    let user = null;
    if (userEmail) {
      user = await User.findOne({ email: userEmail });
      if (!user) {
        user = new User({ email: userEmail });
        await user.save();
      }
    }
    let conversation = null;
    if (userEmail) {
      conversation = await Conversation.findOne({
        userEmail,
        status: 'active'
      });
    }
    if (conversation) {
      const redis = await createRedisClient();
      try {
        const response = await conversationEngine.process(conversation, userMessage, { user, redis });
        return res.json({ text: response });
      } catch (err) {
        console.error('Conversation engine error:', err);
      }
    }
    const aiResponse = await detectIntent(userMessage, userEmail, user);
    return res.json({ text: aiResponse });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.json({ text: 'An error occurred. Please try again.' });
  }
};

async function detectIntent(userMessage, userEmail, user) {
  const prompt = `You are an AI bot assistant that handles 12 different bot types.

AVAILABLE BOTS:
1. task - Task Manager
2. meeting - Meeting Scheduler (creates Zoho Meeting link)
3. travel - Travel Planner
4. reminder - Reminder Bot
5. interview - Interview Scheduler
6. weather - Weather Bot
7. news - News Bot
8. crypto - Crypto Bot
9. market - Market Bot
10. business - Business Insights Bot
11. coding - Coding Bot
12. chat - General Chat Bot

SPECIAL INTENTS:
- "show all", "view everything", "list all data", "show my data" → action: "list_all"
- "delete task 1", "remove meeting 2", "delete my last reminder" → action: "delete", targetId: extracted ID or "last"
- "delete all tasks", "clear all meetings", "remove everything" → action: "delete_all", botType: extracted or "all"

USER MESSAGE: "${userMessage}"

Analyze the message and return ONLY valid JSON with this structure:

{
  "intent": "create|read|update|delete|delete_all|list_all|external_api|chat",
  "bot": "task|meeting|travel|reminder|interview|weather|news|crypto|market|business|coding|chat",
  "action": "create|read|update|delete|delete_all|list_all",
  "data": {  },
  "sendEmail": true|false,
  "needsStepByStep": true|false
}

Return strictly the JSON object only.`;

  try {
    const geminiRaw = await callGemini(prompt);
    let aiText = '';
    if (!geminiRaw) {
      console.warn('Gemini returned empty response');
      return "I couldn't understand that. Could you rephrase?";
    }
    if (typeof geminiRaw === 'string') aiText = geminiRaw;
    else if (geminiRaw.text) aiText = geminiRaw.text;
    else if (geminiRaw.output || geminiRaw.result || geminiRaw.data) aiText = JSON.stringify(geminiRaw);
    else aiText = JSON.stringify(geminiRaw);

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in Gemini response:', aiText.slice(0, 200));
      return "I couldn't understand that. Could you rephrase?";
    }

    let intent;
    try {
      intent = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('JSON parse error from Gemini text:', err, jsonMatch[0].slice(0, 200));
      return "I couldn't parse your request fully. Could you rephrase with more details?";
    }

    console.log(' Gemini Intent:', JSON.stringify(intent, null, 2));
    if (intent.action === 'list_all' || intent.action === 'read') {
      if (!userEmail) return 'I need your email to show your saved data. Please provide a valid email address.';
      return await handleListAll(userEmail);
    }
    if (intent.action === 'delete') {
      if (!userEmail) return 'I need your email to delete your items. Please provide a valid email address.';
      return await handleDelete(userEmail, intent);
    }

    if (intent.action === 'delete_all') {
      if (!userEmail) return 'I need your email to delete your items. Please provide a valid email address.';
      return await handleDeleteAll(userEmail, intent.bot);
    }
    if (intent.bot === 'weather') {
      return await handleWeather(intent.data || {}, { email: userEmail }, intent.sendEmail);
    }

    if (intent.bot === 'news') {
      return await handleNews(intent.data || {}, { email: userEmail }, intent.sendEmail);
    }

    if (intent.bot === 'crypto' || intent.bot === 'market') {
      return await handleMarket(intent.data || {}, { email: userEmail }, intent.sendEmail);
    }

    if (intent.bot === 'coding') {
      return await handleCoding(userMessage, intent.data || {}, { email: userEmail }, intent.sendEmail);
    }

    if (intent.bot === 'chat') {
      return await handleChat(userMessage, { email: userEmail });
    }

    if (intent.bot === 'business') {
      return await handleBusinessInsights(userMessage, intent.data || {}, { email: userEmail }, intent.sendEmail);
    }
    if (intent.needsStepByStep) {
      if (botDefinitions[intent.bot]?.requiresEmail && !userEmail) {
        return 'I need your email to continue. Please provide a valid email address.';
      }
      return await startStepByStepConversation({ email: userEmail }, intent.bot);
    }
    if (botDefinitions[intent.bot]?.requiresEmail && !userEmail) {
      return 'I need your email to proceed with this action. Please provide your email.';
    }

    return await executeSinglePrompt({ email: userEmail }, intent);

  } catch (err) {
    console.error('Intent Detection Error:', err);
    return 'Sorry, I had trouble processing that. Could you try again?';
  }
}

async function handleListAll(email) {
  const allData = await crudService.readRecords({ botName: null, userEmail: email, filter: {}, limit: 500 })
    .catch(async () => {
      if (typeof crudService.getAllByEmail === 'function') return crudService.getAllByEmail(email);
      return [];
    });

  if (!allData || allData.length === 0) {
    return 'You don\'t have any saved data yet.'; 
  }

  const grouped = {};
  allData.forEach(item => {
    const botType = item.botName || item.botType || 'unknown';
    if (!grouped[botType]) grouped[botType] = [];
    grouped[botType].push(item);
  });

  let response = '**YOUR SAVED DATA**\n\n';

  for (const [botType, items] of Object.entries(grouped)) {
    const botName = botDefinitions[botType]?.name || botType;
    response += `**[${botName.toUpperCase()}]**\n`;

    items.forEach((item, idx) => {
      response += `${idx + 1}. `;
      if (item.data && item.data.title) response += item.data.title;
      else if (item.data && item.data.from && item.data.to) response += `${item.data.from} → ${item.data.to}`;
      else response += JSON.stringify(item.data).slice(0, 80);

      const when = item.data?.dueDate || item.data?.date || item.createdAt;
      if (when) {
        response += ` | ${new Date(when).toLocaleString()}`;
      }
      response += ` (ID: ${item._id})\n`;
    });
    response += '\n';
  }

  response += '\nYou can delete any item by saying "delete task 1" or "delete all tasks"';
  return response;
}

async function handleDelete(email, intent) {
  const target = intent.data?.targetId || intent.data?.id || intent.data?.target || 'last';
  if (target === 'last' || parseInt(target)) {
    const list = await crudService.readRecords({ botName: intent.bot, userEmail: email, limit: 50 });
    if (!list || list.length === 0) return 'No matching items found to delete.';
    let toDelete;
    if (target === 'last') toDelete = list[0];
    else {
      const idx = parseInt(target, 10) - 1;
      toDelete = list[idx];
    }
    if (!toDelete) return 'Could not find the item you want to delete.';
    await crudService.deleteRecord({ id: toDelete._id });
    return 'Item deleted successfully!';
  }

  if (/^[0-9a-fA-F]{24}$/.test(String(target))) {
    await crudService.deleteRecord({ id: target });
    return 'Item deleted successfully!';
  }

  return 'Could not understand which item to delete. Please specify item number or provide the item id.';
}

async function handleDeleteAll(email, botType) {

  if (!botType || botType === 'all') {
    await crudService.deleteAll({
      filter: { email }  
    });
    return 'All your data has been deleted.';
  }
  await crudService.deleteAll({
    filter: { email, botName: botType }   
  });

  const botName = botDefinitions[botType]?.name || botType;
  return `All ${botName} records have been deleted.`;
}


async function startStepByStepConversation(user, botType) {
  const botDef = botDefinitions[botType];
  if (!botDef) return `Bot type "${botType}" not found.`;

  const conversation = new Conversation({
    userId: user.email,   
    email: user.email,
    botType: botType,     
    status: 'active',
    currentStep: 0,
    collectedData: {}
  });
  
  await conversation.save();
  
  return `Starting ${botDef.name}!\n\n${botDef.fields[0].question}\n\nType "exit" to cancel, "back" to go back, or "skip" for optional fields.`;
}
async function executeSinglePrompt(user, intent) {
  const botDef = botDefinitions[intent.bot];
  if (!botDef) return `Bot "${intent.bot}" not recognized.`;

  const requiredMissing = [];
  if (botDef.fields && Array.isArray(botDef.fields)) {
    for (const field of botDef.fields) {
      if (field.required && !(intent.data && intent.data[field.name])) {
        requiredMissing.push(field.name);
      }
    }
  }

  if (requiredMissing.length > 0) {
    return `Missing required information: ${requiredMissing.join(', ')}. Please provide all details or I'll ask step-by-step.`;
  }

  try {
    if (typeof conversationEngine.executeDirect === 'function') {
      return await conversationEngine.executeDirect(user, intent.bot, intent.data, intent.sendEmail);
    }
    const created = await crudService.createRecord({ botName: intent.bot, userEmail: user.email, data: intent.data });
    return `${botDef.name} created successfully. ID: ${created._id}`;
  } catch (err) {
    console.error('Single prompt execution error:', err);
    return 'Failed to create. Let me ask step-by-step instead.\n' + await startStepByStepConversation(user, intent.bot);
  }
}

async function handleWeather(data, user, sendEmail) {
  try {
    const city = data.location || data.city || 'Mumbai';
    const weather = await getWeather(city);
    const cityName = weather.name || city;
    let response = `**Weather in ${cityName}**\n\n`;
    response += `Temperature: ${Math.round((weather.main.temp - 273.15) * 10) / 10}°C\n`;
    response += `Condition: ${weather.weather?.[0]?.description || 'N/A'}\n`;
    response += `Humidity: ${weather.main?.humidity || 'N/A'}%\n`;

    if (sendEmail && user?.email) {
      try {
        await emailService.sendPlainText(
          user.email,
          `Weather Report - ${cityName}`,
          response
        );
        response += `\n\nEmail sent to ${user.email}`;
      } catch (err) {
        console.error('Weather email error:', err);
        response += `\n\nFailed to send email.`;
      }
    } else if (sendEmail) {
      response += '\n\nI need your email to send this. Please provide a valid email.';
    } else {
      if (sendEmail) response += '\n\nWould you like me to email this? (yes/no)';
    }

    return response;
  } catch (err) {
    console.error('Weather error', err);
    return 'Could not fetch weather data. Please try again.';
  }
}

async function handleNews(data, user, sendEmail) {
  try {
    const category = data.category || 'technology';
    const news = await getNews(category);
    let response = `**Top News - ${category}**\n\n`;
    const articles = (news.articles || []).slice(0, 5);
    articles.forEach((article, idx) => {
      response += `${idx + 1}. ${article.title}\n   Source: ${article.source?.name || 'N/A'}\n   ${article.url}\n\n`;
    });

    if (sendEmail && user?.email) {
      try {
        await emailService.sendPlainText(
          user.email,
          `Top News - ${category}`,
          response
        );
        response += `\nEmail sent to ${user.email}`;
      } catch (err) {
        console.error('News email error:', err);
        response += `\n Failed to send email.`;
      }
    } else if (sendEmail) {
      response += '\n\nI need your email to send this. Please provide a valid email.';
    } else {
      if (sendEmail) response += ' Would you like me to email this? (yes/no)';
    }

    return response;
  } catch (err) {
    console.error('News error', err);
    return 'Could not fetch news. Please try again.';
  }
}

async function handleMarket(data, user, sendEmail) {
  try {
    const coin = (data.coin || data.symbol || data.cryptocurrency || 'bitcoin').toString().toLowerCase();
    const market = await getMarketData(coin);
    let response = ` **${coin.toUpperCase()} Market Data**\n\n`;
    response += ` USD: $${market.usd ?? 'N/A'}\n`;
    if (market.inr) response += ` INR: ₹${market.inr}\n`;
    if (market.usd_24h_change) response += ` 24h Change: ${market.usd_24h_change}%\n`;

    if (sendEmail && user?.email) {
      try {
        await emailService.sendPlainText(
          user.email,
          `${coin.toUpperCase()} Market Data`,
          response
        );
        response += `\n\n Email sent to ${user.email}`;
      } catch (err) {
        console.error('Market email error:', err);
        response += `\n\n Failed to send email.`;
      }
    } else if (sendEmail) {
      response += '\n\n I need your email to send this. Please provide a valid email.';
    } else {
      if (sendEmail) response += '\n\n Email this report? (yes/no)';
    }

    return response;
  } catch (err) {
    console.error('Market error', err);
    return ' Could not fetch market data. Please try again.';
  }
}

async function handleCoding(userMessage, data, user, sendEmail) {
  const prompt = `You are a helpful coding assistant. Answer this query concisely:\n\n${data.query || userMessage}`;
  try {
    const answerObj = await callGemini(prompt);
    const answer = typeof answerObj === 'string' ? answerObj : (answerObj.text || JSON.stringify(answerObj));
    let response = ` **Coding Assistant**\n\n${answer}\n`;

    if (sendEmail && user?.email) {
      try {
        await emailService.sendPlainText(user.email, 'Coding Assistant Result', response);
        response += `\n\n Email sent to ${user.email}`;
      } catch (err) {
        console.error('Coding email error:', err);
        response += `\n\n Failed to send email.`;
      }
    } else if (sendEmail) {
      response += '\n\n I need your email to send this. Please provide a valid email.';
    }

    return response;
  } catch (err) {
    console.error('Coding error', err);
    return '❌ Could not generate code. Please try again.';
  }
}

async function handleBusinessInsights(userMessage, data, user, sendEmail) {
  const prompt = `You are a business analyst. Provide insights for:\n\n${data.query || userMessage}\n\nBe concise and actionable.`;
  try {
    const answerObj = await callGemini(prompt);
    const answer = typeof answerObj === 'string' ? answerObj : (answerObj.text || JSON.stringify(answerObj));
    let response = `**Business Insights**\n\n${answer}`;

    if (sendEmail && user?.email) {
      try {
        await emailService.sendPlainText(user.email, 'Business Insights', response);
        response += `\n\n Email sent to ${user.email}`;
      } catch (err) {
        console.error('Business email error:', err);
        response += `\n\n Failed to send email.`;
      }
    } else if (sendEmail) {
      response += '\n\n I need your email to send this. Please provide a valid email.';
    }

    return response;
  } catch (err) {
    console.error('Business insights error', err);
    return ' Could not generate insights. Please try again.';
  }
}

async function handleChat(userMessage, user) {
  const prompt = `Have a friendly conversation. User says: "${userMessage}"\n\nRespond naturally and helpfully.`;
  try {
    const responseObj = await callGemini(prompt);
    const text = typeof responseObj === 'string' ? responseObj : (responseObj.text || JSON.stringify(responseObj));
    return ` ${text}`;
  } catch (err) {
    console.error('Chat error', err);
    return "Sorry, I couldn't process that. Try again?";
  }
}

module.exports = {
  handleListAll,
  handleDelete,
  handleDeleteAll,
  startStepByStepConversation,
  executeSinglePrompt,
  handleWeather,
  handleNews,
  handleMarket,
  handleCoding,
  handleBusinessInsights,
  handleChat,
  detectIntent
};
