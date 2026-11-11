import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const discordEventWebhooks: Record<string, { env: string; title: string; color: number; adminOnly: boolean }> = {
  tournament_created: { env: 'DISCORD_TOUR_CREATE_WEBHOOK', title: 'Tournament created', color: 0x22c55e, adminOnly: true },
  tournament_deleted: { env: 'DISCORD_TOUR_DELETE_WEBHOOK', title: 'Tournament deleted', color: 0xef4444, adminOnly: true },
  team_account_created: { env: 'DISCORD_SQUAD_REGISTER_WEBHOOK', title: 'Squad account created', color: 0x6366f1, adminOnly: false },
  tournament_registered: { env: 'DISCORD_TOUR_REGISTER_WEBHOOK', title: 'Tournament registration', color: 0x3b82f6, adminOnly: false },
  wallet_credited: { env: 'DISCORD_ADD_MONEY_WEBHOOK', title: 'Wallet money added', color: 0xf59e0b, adminOnly: true },
  wallet_topup_requested: { env: 'DISCORD_ADD_MONEY_WEBHOOK', title: 'Wallet top-up requested', color: 0xf59e0b, adminOnly: false },
  paid_tournament_fee: { env: 'DISCORD_TOUR_FEE_WEBHOOK', title: 'Paid tournament fee', color: 0xa855f7, adminOnly: false },
};

async function isAuthorizedAdmin(token: string): Promise<boolean> {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return false;
  const identity = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
  });
  if (!identity.ok) return false;
  const userData = await identity.json() as { users?: Array<{ localId?: string }> };
  const uid = userData.users?.[0]?.localId;
  if (!uid) return false;
  const projectId = 'ai-studio-applet-webapp-9b7f3';
  const databaseId = 'ai-studio-ogxo7freefirescr-5beaaaf9-c76e-4ff1-8771-509dc493c782';
  const admin = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/admins/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!admin.ok) return false;
  const data = await admin.json() as { fields?: { enabled?: { booleanValue?: boolean } } };
  return data.fields?.enabled?.booleanValue === true;
}

app.post('/api/discord-event', async (req: Request, res: Response) => {
  try {
    const { event, data = {} } = req.body as { event?: string; data?: Record<string, unknown> };
    const config = event ? discordEventWebhooks[event] : undefined;
    if (!config) return res.status(400).json({ error: 'Unknown Discord event.' });
    const webhook = process.env[config.env] || '';
    if (!webhook) return res.status(503).json({ error: 'Discord event webhook is not configured.' });
    if (config.adminOnly) {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
      if (!token || !await isAuthorizedAdmin(token)) return res.status(401).json({ error: 'Admin access required.' });
    }
    const fields = Object.entries(data).slice(0, 20).map(([name, value]) => ({
      name: String(name).slice(0, 200),
      value: String(Array.isArray(value) ? value.join(' · ') : value ?? '—').replace(/[\u0000-\u001f]/g, ' ').slice(0, 900),
      inline: true,
    }));
    await sendDiscordEmbed(webhook, {
      title: config.title,
      description: '',
      color: config.color,
      fields,
      footer: { text: 'OG x o7 Scrims' },
      timestamp: new Date().toISOString(),
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Discord event error:', error);
    return res.status(502).json({ error: 'Could not send Discord event.' });
  }
});

// In-memory / fallback store for Discord webhook configuration
interface AdminConfig {
  discordWebhookUrl: string;
  discordEnabled: boolean;
}

let adminConfig: AdminConfig = {
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  discordEnabled: true,
};

// Config file path for persistent server settings
const configFilePath = path.join(__dirname, '.admin-config.json');
if (fs.existsSync(configFilePath)) {
  try {
    const raw = fs.readFileSync(configFilePath, 'utf-8');
    adminConfig = { ...adminConfig, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to read config file:', e);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(adminConfig, null, 2));
  } catch (e) {
    console.error('Failed to save config file:', e);
  }
}

// Helper to send Discord Webhook embed
async function sendDiscordEmbed(webhookUrl: string, embedData: {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    throw new Error('Invalid or empty Discord Webhook URL');
  }

  const payload = {
    username: 'OG x o7 Scrims Bot',
    avatar_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=128&auto=format&fit=crop&q=80',
    embeds: [embedData],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API error (${response.status}): ${text}`);
  }
  return true;
}

// API: Send Discord Notification for Team Registration
app.post('/api/discord-notify', async (req: Request, res: Response) => {
  try {
    const {
      registrationId,
      teamName,
      leaderName,
      leaderUid,
      playerCount = 5,
      registrationTime,
      currentRegisteredCount,
      maxTeams = 12,
      remainingSlots,
      tournamentName = 'Free Fire Scrims',
      customWebhookUrl,
    } = req.body;

    if (!registrationId || !teamName || !leaderName) {
      return res.status(400).json({ error: 'Missing required registration details' });
    }

    const webhookToUse = customWebhookUrl || adminConfig.discordWebhookUrl;

    if (!webhookToUse) {
      // If no webhook configured yet, log safely and inform caller
      console.log(`[DISCORD NOTIFY PENDING] Team "${teamName}" (${registrationId}) registered. No webhook URL set yet.`);
      return res.status(200).json({
        success: true,
        delivered: false,
        message: 'Registration recorded. Set Discord Webhook URL in Admin Panel to receive Discord alerts.',
      });
    }

    const embed = {
      title: `🔥 New Team Registered: ${teamName}`,
      description: `**Tournament:** ${tournamentName}\nA new squad has officially joined the scrims!`,
      color: 0x6366F1, // Esports Purple / Indigo
      fields: [
        { name: '📋 Registration ID', value: `\`${registrationId}\``, inline: true },
        { name: '👑 Team Leader', value: leaderName, inline: true },
        { name: '👥 Squad Players', value: Array.isArray(req.body.players) ? req.body.players.join(' • ') : '5 Players (4 Main + 1 Backup)', inline: false },
        { name: '📊 Slot Progress', value: `**${currentRegisteredCount} / ${maxTeams} Teams**`, inline: true },
        { name: '⏳ Remaining Slots', value: `**${remainingSlots} Slot${remainingSlots === 1 ? '' : 's'} Left**`, inline: true },
        { name: '🕒 Registration Time', value: registrationTime || new Date().toISOString(), inline: true },
      ],
      footer: { text: 'OG x o7 Free Fire Esports Scrims Management' },
      timestamp: new Date().toISOString(),
    };

    await sendDiscordEmbed(webhookToUse, embed);

    return res.status(200).json({
      success: true,
      delivered: true,
      message: 'Discord notification delivered successfully!',
    });
  } catch (error: any) {
    console.error('Discord webhook error:', error);
    return res.status(500).json({
      success: false,
      delivered: false,
      error: error.message || 'Failed to dispatch Discord webhook',
    });
  }
});

// API: Test Discord Webhook
app.post('/api/admin/discord-test', async (req: Request, res: Response) => {
  try {
    const { webhookUrl } = req.body;
    const url = webhookUrl || adminConfig.discordWebhookUrl;

    if (!url) {
      return res.status(400).json({ error: 'Please provide a valid Discord Webhook URL' });
    }

    const embed = {
      title: '✅ Discord Webhook Connected: OG x o7 Scrims',
      description: 'Your Discord channel is now securely configured to receive automatic team registration notifications!',
      color: 0x10B981, // Emerald Green
      fields: [
        { name: 'Status', value: '🟢 Active & Ready', inline: true },
        { name: 'Game', value: 'Garena Free Fire', inline: true },
        { name: 'Configured At', value: new Date().toLocaleTimeString(), inline: true },
      ],
      footer: { text: 'OG x o7 System Test Notification' },
      timestamp: new Date().toISOString(),
    };

    await sendDiscordEmbed(url, embed);
    return res.status(200).json({ success: true, message: 'Test message sent to Discord!' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send test message' });
  }
});

// API: Get / Save Admin Server Settings
app.get('/api/admin/config', (req: Request, res: Response) => {
  res.json({
    hasDiscordWebhook: Boolean(adminConfig.discordWebhookUrl),
    discordWebhookMasked: adminConfig.discordWebhookUrl
      ? adminConfig.discordWebhookUrl.replace(/(webhooks\/\d+\/)(.+)/, '$1••••••••')
      : '',
    discordEnabled: adminConfig.discordEnabled,
  });
});

app.post('/api/admin/config', (req: Request, res: Response) => {
  const { discordWebhookUrl, discordEnabled } = req.body;
  if (discordWebhookUrl !== undefined) {
    adminConfig.discordWebhookUrl = discordWebhookUrl.trim();
  }
  if (discordEnabled !== undefined) {
    adminConfig.discordEnabled = Boolean(discordEnabled);
  }
  saveConfig();
  res.json({ success: true, message: 'Admin settings saved successfully' });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`OG x o7 Scrims Server running on port ${PORT}`);
  });
}

startServer();
