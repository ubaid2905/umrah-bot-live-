// index.js
// Main server — the heart of the bot

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { getSession, addToHistory } = require('./sessions');
const { getAIResponse } = require('./ai');
const { sendTextMessage } = require('./whatsapp');

// Import Activity model for logging
const Activity = require('./dashboard/backend/models/Activity');

const app = express();

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/umrah-bot-dashboard', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ Connected to MongoDB for logging'))
  .catch(err => console.error('⚠️  MongoDB connection warning:', err.message));
}

// Parse incoming JSON from Meta's webhook
app.use(express.json());

// ── ROUTE 1: Webhook Verification ─────────────────────────────────────────────
// When you register your webhook in Meta's dashboard, Meta sends a GET
// request to verify you own the server. This handles that.
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔔 Webhook verification attempt received');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    // Verification passed — send the challenge back to Meta
    console.log('✅ Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    // Wrong token — reject
    console.error('❌ Webhook verification failed — wrong token');
    res.sendStatus(403);
  }
});

// ── ROUTE 2: Incoming Messages ────────────────────────────────────────────────
// Every time a customer sends a WhatsApp message, Meta sends a POST here
app.post('/webhook', async (req, res) => {

  // CRITICAL: Always respond 200 to Meta immediately
  // If you don't, Meta will retry the same message repeatedly
  res.sendStatus(200);

  try {
    const body = req.body;

    // Validate the structure — Meta sends many event types, we only want messages
    if (
      !body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    ) {
      return; // Not a message event, ignore silently
    }

    const value   = body.entry[0].changes[0].value;
    const message = value.messages[0];
    const from    = message.from; // Customer's phone number e.g. "923001234567"

    // ── Only handle text messages for now ────────────────────────────────────
    if (message.type !== 'text') {
      await sendTextMessage(
        from,
        'I can currently read text messages only. Please type your question ' +
        'and I will be happy to help! 😊'
      );
      return;
    }

    const incomingText = message.text.body.trim();
    console.log(`\n📩 New message from ${from}: "${incomingText}"`);

    // ── Check for escalation keywords ────────────────────────────────────────
    const escalationKeywords = [
      'agent', 'human', 'manager', 'complaint', 'refund',
      'urgent', 'problem', 'انسان', 'شکایت', 'فوری', 'مسئلہ'
    ];
    const needsHuman = escalationKeywords.some(
      keyword => incomingText.toLowerCase().includes(keyword)
    );

    if (needsHuman) {
      console.log(`🚨 Escalation triggered for ${from}`);
      await sendTextMessage(
        from,
        'I understand you need immediate assistance. I am connecting you ' +
        'with one of our consultants right now, please hold for just a moment.\n\n' +
        'You can also reach us directly:\n' +
        '📞 +92-300-1234567\n' +
        '🕐 Mon–Sat, 9am–7pm PKT'
      );
      // TODO: Here you can add a Slack/email notification to alert your team
      return;
    }

    // ── Get the customer's conversation history ───────────────────────────────
    const session = getSession(from);

    // Save their incoming message to history
    addToHistory(from, 'user', incomingText);

    // ── Get AI response ───────────────────────────────────────────────────────
    // Pass history MINUS the last message (since getAIResponse adds it)
    const historyToSend = session.history.slice(0, -1);
    console.log(`💭 Asking AI (history length: ${historyToSend.length} messages)`);

    const startTime = Date.now();
    const aiReply = await getAIResponse(historyToSend, incomingText);
    const responseTime = Date.now() - startTime;

    // Save AI response to history
    addToHistory(from, 'assistant', aiReply);

    // ── Log activity to MongoDB ───────────────────────────────────────────────
    if (mongoose.connection.readyState === 1) {
      try {
        const activity = new Activity({
          phoneNumber: from,
          userMessage: incomingText,
          botResponse: aiReply,
          metadata: {
            responseTime: responseTime
          }
        });
        await activity.save();
      } catch (logErr) {
        console.warn('⚠️  Failed to log activity:', logErr.message);
      }
    }

    // ── Send reply back to customer ───────────────────────────────────────────
    await sendTextMessage(from, aiReply);
    console.log(`✅ Reply sent to ${from}`);

  } catch (error) {
    console.error('❌ Webhook handler crashed:', error.message);
    console.error(error.stack);
  }
});

// ── Activity Logging Endpoint (called by dashboard) ────────────────────────────
app.post('/api/log-activity', async (req, res) => {
  try {
    const { phoneNumber, userMessage, botResponse, responseTime } = req.body;

    if (!mongoose.connection.readyState === 1) {
      return res.status(503).json({ message: 'Database not connected' });
    }

    const activity = new Activity({
      phoneNumber,
      userMessage,
      botResponse,
      metadata: { responseTime }
    });

    await activity.save();
    res.status(201).json({ message: 'Activity logged' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ── Health check route ────────────────────────────────────────────────────────
// Useful to confirm your server is alive
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    bot: 'Umrah Travel Bot',
    provider: process.env.AI_PROVIDER || 'gemini',
    uptime: `${Math.floor(process.uptime())} seconds`
  });
});

// ── Start the server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🕌  Umrah Travel Bot — STARTED');
  console.log(`🌐  Port: ${PORT}`);
  console.log(`🤖  AI: ${(process.env.AI_PROVIDER || 'gemini').toUpperCase()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});