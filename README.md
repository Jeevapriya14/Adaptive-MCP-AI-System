# SCOUTBUILD - Zoho Cliq AI Bot Engine

Complete dynamic backend system for business automation via Zoho Cliq.

## 🚀 Features

✅ **Zoho Cliq Integration** - Single webhook endpoint (POST /webhook)
✅ **Gemini AI** - Natural language understanding
✅ **Step-by-Step Conversation** - Guided bot flows with back/skip/exit
✅ **Email Collection** - Validates and stores user email
✅ **Date Validation** - Prevents past dates
✅ **MongoDB Cloud** - Full CRUD operations
✅ **Redis Cloud** - Session management
✅ **Google Calendar** - Auto-scheduling with invites
✅ **HTML Email System** - Beautiful confirmation emails
✅ **24h Reminders** - Automated email reminders
✅ **External APIs** - Weather, News, Jobs, Market data

## 📦 Installation

```bash
npm install
```

## 🔧 Configuration

All environment variables are pre-configured in `.env` file:
- MongoDB URI (your cluster)
- Redis URL (your instance)
- Gemini API key
- Gmail credentials
- Google Calendar OAuth
- External API keys

## 🚀 Start Server

```bash
npm start
```

Server runs on: **http://localhost:3000**

## 📡 Zoho Cliq Integration

### Webhook Endpoint

```
POST http://localhost:3000/webhook
Content-Type: text/plain

schedule a meeting tomorrow with ravi@example.com
```

### Response Format

```json
{
  "text": "📝 Meeting title?"
}
```

## 🤖 Supported Bots

1. **Task** - Task management with priorities
2. **Meeting** - Calendar scheduling with invites
3. **Reminder** - Simple reminders
4. **Leave** - Leave requests
5. **Expense** - Expense claims
6. **Invoice** - Invoice generation
7. **Lead** - CRM lead capture
8. **Incident** - IT incident reporting
9. **Bug** - Bug tracking
10. **Inventory** - Inventory management

## 📝 Conversation Flow

1. User sends message to Zoho Cliq
2. Zoho Cliq forwards to `/webhook`
3. Gemini AI detects intent and bot type
4. System asks questions step-by-step
5. User answers (or uses back/skip/exit)
6. System validates each field
7. On completion:
   - Saves to MongoDB
   - Creates calendar event (if meeting)
   - Sends HTML confirmation email
   - Schedules 24h reminder email
   - Returns summary to Zoho Cliq

## 🎮 Flow Controls

- **back** - Go to previous question
- **skip** - Skip optional field
- **exit/cancel/quit** - Cancel conversation

## 📧 Email System

- **Confirmation Email** - Sent immediately after completion
- **Reminder Email** - Sent 24 hours before event date
- **HTML Template** - Beautiful, responsive design
- **Bull Queue** - Reliable background processing

## 📅 Google Calendar

- Auto-creates events for meetings
- Sends invites to all attendees
- Returns event link
- Timezone: Asia/Kolkata

## 🌐 External APIs

- **Weather** - OpenWeather API
- **News** - NewsAPI
- **Jobs** - Adzuna API
- **Market** - CoinGecko API

## 🗂️ Project Structure

```
scoutbuild/
├── server.js              # Main entry point
├── config/                # Configuration
│   ├── redis.js
│   ├── bull.js
│   ├── gemini.js
│   └── calendar.js
├── models/                # MongoDB schemas
│   ├── User.js
│   ├── Conversation.js
│   └── BotData.js
├── routes/
│   └── webhook.js         # Main webhook handler
├── services/              # Business logic
│   ├── conversationEngine.js
│   ├── botDefinitions.js
│   ├── crudService.js
│   ├── calendarService.js
│   ├── emailService.js
│   └── externalAPIs.js
└── workers/               # Background jobs
    ├── emailWorker.js
    └── reminderWorker.js
```

## 🧪 Testing

### Test with cURL

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: text/plain" \
  -H "X-User-Id: test@example.com" \
  -d "create a task for tomorrow"
```

### Expected Flow

1. System asks: "📝 What is the task title?"
2. User: "Complete API documentation"
3. System asks: "📄 Task description?"
4. User: "skip"
5. System asks: "👤 Who is assigned? (email)"
6. User: "john@example.com"
7. ... continues until all fields collected
8. System: "✅ TASK CREATED! ..."

## 🔒 Security

- Email validation
- Date validation (no past dates)
- Redis session expiry
- Secure OAuth tokens
- Environment variables for secrets

## 📊 Monitoring

Check health:
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "mongodb": "connected",
  "redis": "connected"
}
```

## 🚀 Production Deployment

1. Update environment variables
2. Use PM2 for process management:
```bash
pm2 start server.js --name scoutbuild
```

## 🤝 Support

All services are pre-configured and working. System is production-ready!

---

**Built with ❤️ for Zoho Cliq Integration**
