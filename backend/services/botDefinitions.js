module.exports = {
  task: {
    name: 'Task Manager',
    emailRequired: true,
    autoEmail: true,
    fields: [
      { name: 'title', type: 'text', question: ' What is the task title?', required: true },
      { name: 'description', type: 'text', question: ' Task description?', required: false },
      { name: 'priority', type: 'text', question: 'Priority (low/medium/high)?', required: true },
      { name: 'dueDate', type: 'datetime', question: 'Due date and time?', required: true }
    ]
  },

  meeting: {
    name: 'Meeting Scheduler',
    emailRequired: true,
    autoEmail: true,
    createZohoMeeting: true,
    fields: [
      { name: 'title', type: 'text', question: 'Meeting title?', required: true },
      { name: 'date', type: 'datetime', question: 'When (date & time)?', required: true },
      { name: 'duration', type: 'number', question: 'Duration in minutes?', required: true },
      { name: 'attendees', type: 'text', question: ' Attendees (comma-separated emails)?', required: true },
      { name: 'agenda', type: 'text', question: 'Meeting agenda?', required: false }
    ]
  },

  travel: {
    name: 'Travel Planner',
    emailRequired: true,
    autoEmail: true,
    fields: [
      { name: 'from', type: 'text', question: ' From which city?', required: true },
      { name: 'to', type: 'text', question: 'To which city?', required: true },
      { name: 'departureDate', type: 'datetime', question: 'Departure date & time?', required: true },
      { name: 'returnDate', type: 'datetime', question: 'Return date & time?', required: false },
      { name: 'travelers', type: 'number', question: 'Number of travelers?', required: false }
    ]
  },

  reminder: {
    name: 'Reminder Bot',
    emailRequired: true,
    autoEmail: true,
    fields: [
      { name: 'title', type: 'text', question: ' What should I remind you about?', required: true },
      { name: 'description', type: 'text', question: ' Additional details?', required: false },
      { name: 'date', type: 'datetime', question: 'When to remind you?', required: true },
      { name: 'repeat', type: 'text', question: 'Repeat (daily/weekly/monthly/none)?', required: false }
    ]
  },

  interview: {
    name: 'Interview Scheduler',
    emailRequired: true,
    autoEmail: true,
    fields: [
      { name: 'candidateName', type: 'text', question: ' Candidate name?', required: true },
      { name: 'candidateEmail', type: 'email', question: 'Candidate email?', required: true },
      { name: 'position', type: 'text', question: 'Position title?', required: true },
      { name: 'date', type: 'datetime', question: 'Interview date & time?', required: true },
      { name: 'interviewers', type: 'text', question: ' Interviewer emails?', required: false },
      { name: 'mode', type: 'text', question: 'Mode (online/offline)?', required: false }
    ]
  },

  weather: {
    name: 'Weather Bot',
    emailRequired: false,
    askEmail: true,
    externalAPI: true,
    fields: [
      { name: 'location', type: 'text', question: ' Which city weather do you want?', required: true },
      { name: 'date', type: 'date', question: 'For which date?', required: false }
    ]
  },

  news: {
    name: 'News Bot',
    emailRequired: false,
    askEmail: true,
    externalAPI: true,
    fields: [
      { name: 'topic', type: 'text', question: ' News topic or keyword?', required: true },
      { name: 'category', type: 'text', question: 'Category?', required: false },
      { name: 'count', type: 'number', question: 'How many articles?', required: false }
    ]
  },

 
  crypto: {
    name: 'Crypto Bot',
    emailRequired: false,
    askEmail: true,
    externalAPI: true,
    fields: [
      { name: 'coin', type: 'text', question: ' Which cryptocurrency?', required: true },
      { name: 'currency', type: 'text', question: ' Currency?', required: false }
    ]
  },

  market: {
    name: 'Market Bot',
    emailRequired: false,
    askEmail: true,
    externalAPI: true,
    fields: [
      { name: 'symbol', type: 'text', question: ' Stock/Index symbol?', required: true },
      { name: 'period', type: 'text', question: 'Period?', required: false }
    ]
  },

  business: {
    name: 'Business Insights Bot',
    emailRequired: false,
    askEmail: true,
    fields: [
      { name: 'query', type: 'text', question: ' What business insight do you need?', required: true },
      { name: 'industry', type: 'text', question: ' Industry?', required: false },
      { name: 'timeframe', type: 'text', question: ' Timeframe?', required: false }
    ]
  },

  coding: {
    name: 'Coding Bot',
    emailRequired: false,
    askEmail: true,
    fields: [
      { name: 'query', type: 'text', question: ' What coding help do you need?', required: true },
      { name: 'language', type: 'text', question: 'Language?', required: false },
      { name: 'saveCode', type: 'boolean', question: 'Save this code snippet?', required: false }
    ]
  },


  chat: {
    name: 'Chat Bot',
    emailRequired: false,
    askEmail: false,
    fields: [
      { name: 'message', type: 'text', question: 'What would you like to chat about?', required: true },
      { name: 'saveChat', type: 'boolean', question: 'Save this conversation?', required: false }
    ]
  }
};
