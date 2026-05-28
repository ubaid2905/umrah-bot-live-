// index.js — Bot + Dashboard merged into one server
require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const path     = require('path');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');

const { getAIResponse }    = require('./ai');
const { sendTextMessage }  = require('./whatsapp');
const Activity             = require('./dashboard/backend/models/Activity');
const User                 = require('./dashboard/backend/models/User');

const app = express();
app.use(express.json());

// ── Serve dashboard frontend ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dashboard/frontend')));

// ── Connect to MongoDB ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

// ── JWT auth middleware ───────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'umrah_jwt_secret');
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });
    const exists = await User.findOne({ username });
    if (exists)
      return res.status(400).json({ message: 'Username already taken' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash, role: 'agent' });
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'umrah_jwt_secret',
      { expiresIn: '7d' }
    );
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Wrong username or password' });
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'umrah_jwt_secret',
      { expiresIn: '7d' }
    );
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DASHBOARD API ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/stats — summary numbers for the dashboard home
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const total    = await Activity.countDocuments();
    const paused   = await Activity.countDocuments({ isPaused: true });
    const active   = await Activity.countDocuments({ isPaused: false });
    const today    = new Date(); today.setHours(0,0,0,0);
    const newToday = await Activity.countDocuments({ firstSeen: { $gte: today } });
    const msgSum   = await Activity.aggregate([
      { $group: { _id: null, total: { $sum: '$messageCount' } } }
    ]);
    res.json({
      totalCustomers: total,
      activeChats:    active,
      pausedChats:    paused,
      newToday:       newToday,
      totalMessages:  msgSum[0]?.total || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/customers — list all customers, sorted by last active
app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const customers = await Activity.find()
      .select('phoneNumber customerName status isPaused lastMessage lastActive messageCount firstSeen pausedBy')
      .sort({ lastActive: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/customers/:phone — full conversation for one customer
app.get('/api/customers/:phone', requireAuth, async (req, res) => {
  try {
    const customer = await Activity.findOne({ phoneNumber: req.params.phone });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/customers/:phone — update customer name or status
app.patch('/api/customers/:phone', requireAuth, async (req, res) => {
  try {
    const { customerName, status } = req.body;
    const updated = await Activity.findOneAndUpdate(
      { phoneNumber: req.params.phone },
      { $set: { customerName, status } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/customers/:phone/pause — agent takes over, bot stops
app.post('/api/customers/:phone/pause', requireAuth, async (req, res) => {
  try {
    const updated = await Activity.findOneAndUpdate(
      { phoneNumber: req.params.phone },
      { $set: { isPaused: true, pausedBy: req.user.username, pausedAt: new Date(), status: 'paused' } },
      { new: true }
    );
    console.log(`⏸️  Bot paused for ${req.params.phone} by ${req.user.username}`);
    res.json({ ok: true, customer: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/customers/:phone/resume — hand back to bot
app.post('/api/customers/:phone/resume', requireAuth, async (req, res) => {
  try {
    const updated = await Activity.findOneAndUpdate(
      { phoneNumber: req.params.phone },
      { $set: { isPaused: false, pausedBy: null, pausedAt: null, status: 'active' } },
      { new: true }
    );
    console.log(`▶️  Bot resumed for ${req.params.phone} by ${req.user.username}`);
    res.json({ ok: true, customer: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/customers/:phone/reply — agent sends a manual WhatsApp message
app.post('/api/customers/:phone/reply', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message required' });

    // Send via WhatsApp API
    await sendTextMessage(req.params.phone, message);

    // Save to conversation thread
    await Activity.findOneAndUpdate(
      { phoneNumber: req.params.phone },
      {
        $push: { messages: { role: 'agent', content: message } },
        $set:  { lastMessage: message, lastActive: new Date() },
        $inc:  { messageCount: 1 }
      }
    );
    console.log(`👤 Agent ${req.user.username} replied to ${req.params.phone}: ${message}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WHATSAPP WEBHOOK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Deduplication set — prevents double replies if Meta retries
const processedMessages = new Set();

app.post('/webhook', (req, res) => {
  // Always reply 200 immediately so Meta never retries
  res.sendStatus(200);

  setImmediate(async () => {
    try {
      const body = req.body;
      if (!body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) return;

      const value   = body.entry[0].changes[0].value;
      const message = value.messages[0];
      const from    = message.from;

      // Dedup check
      if (processedMessages.has(message.id)) return;
      processedMessages.add(message.id);
      setTimeout(() => processedMessages.delete(message.id), 10 * 60 * 1000);

      // Only handle text
      if (message.type !== 'text') {
        await sendTextMessage(from, 'I can read text messages only. Please type your question 😊');
        return;
      }

      const incomingText = message.text.body.trim();
      console.log(`\n📩 From ${from}: "${incomingText}"`);

      // ── Check if bot is paused for this customer ──────────────────────────
      const customerRecord = await Activity.findOne({ phoneNumber: from });
      if (customerRecord?.isPaused) {
        console.log(`⏸️  Bot is paused for ${from} — message saved, not replying`);
        // Still save the message so agent can see it
        await Activity.findOneAndUpdate(
          { phoneNumber: from },
          {
            $push: { messages: { role: 'user', content: incomingText } },
            $set:  { lastMessage: incomingText, lastActive: new Date() },
            $inc:  { messageCount: 1 }
          }
        );
        return; // Agent is handling — bot stays silent
      }

      // ── Escalation keywords ───────────────────────────────────────────────
      const escalationKeywords = [
        'agent','human','manager','complaint','refund',
        'urgent','problem','انسان','شکایت','فوری','مسئلہ'
      ];
      const needsHuman = escalationKeywords.some(
        kw => incomingText.toLowerCase().includes(kw)
      );

      if (needsHuman) {
        await sendTextMessage(from,
          'I understand you need immediate help. Connecting you with our team now.\n\n' +
          '📞 +92-300-1234567\n🕐 Mon–Sat, 9am–7pm PKT'
        );
        // Auto-pause bot and flag for agent
        await Activity.findOneAndUpdate(
          { phoneNumber: from },
          {
            $push: { messages: { role: 'user', content: incomingText } },
            $set:  { isPaused: true, pausedBy: 'auto-escalation', status: 'paused',
                     lastMessage: incomingText, lastActive: new Date() },
            $inc:  { messageCount: 1 }
          },
          { upsert: true }
        );
        return;
      }

      // ── Get conversation history for this customer ────────────────────────
      const history = (customerRecord?.messages || [])
        .slice(-20)
        .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }));

      // ── Get AI reply ──────────────────────────────────────────────────────
      const start   = Date.now();
      const aiReply = await getAIResponse(history, incomingText);
      const elapsed = Date.now() - start;

      // ── Save both messages to MongoDB ─────────────────────────────────────
      await Activity.findOneAndUpdate(
        { phoneNumber: from },
        {
          $push: { messages: { $each: [
            { role: 'user',  content: incomingText },
            { role: 'bot',   content: aiReply }
          ]}},
          $set: {
            lastMessage:  aiReply.substring(0, 80),
            lastActive:   new Date(),
            status:       'active',
            'metadata.responseTime': elapsed
          },
          $inc: { messageCount: 2 }
        },
        { upsert: true, new: true }
      );

      // ── Send reply to customer ────────────────────────────────────────────
      await sendTextMessage(from, aiReply);
      console.log(`✅ Replied to ${from} in ${elapsed}ms`);

    } catch (err) {
      console.error('❌ Webhook error:', err.message);
    }
  });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status: 'running',
  bot: 'Umrah Travel Bot',
  ai: process.env.AI_PROVIDER || 'gemini',
  uptime: `${Math.floor(process.uptime())}s`
}));

// ── Serve dashboard for all other routes ──────────────────────────────────────
// ── Serve dashboard for all other routes ──────────────────────────────────────
// ── Serve dashboard for all other routes ──────────────────────────────────────
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard/frontend/index.html'));
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🕌  Umrah Travel Bot — STARTED');
  console.log(`🌐  Port: ${PORT}`);
  console.log(`🤖  AI: ${(process.env.AI_PROVIDER || 'gemini').toUpperCase()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});