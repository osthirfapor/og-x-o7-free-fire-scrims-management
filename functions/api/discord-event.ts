interface EventContext {
  request: Request;
  env: Record<string, string | undefined>;
}

const PROJECT_ID = 'ai-studio-applet-webapp-9b7f3';
const DATABASE_ID = 'ai-studio-ogxo7freefirescr-5beaaaf9-c76e-4ff1-8771-509dc493c782';
const EVENT_CONFIG: Record<string, { secret: string; title: string; color: number; adminOnly: boolean }> = {
  tournament_created: { secret: 'DISCORD_TOUR_CREATE_WEBHOOK', title: 'Tournament created', color: 0x22c55e, adminOnly: true },
  tournament_deleted: { secret: 'DISCORD_TOUR_DELETE_WEBHOOK', title: 'Tournament deleted', color: 0xef4444, adminOnly: true },
  team_account_created: { secret: 'DISCORD_SQUAD_REGISTER_WEBHOOK', title: 'Squad account created', color: 0x6366f1, adminOnly: false },
  tournament_registered: { secret: 'DISCORD_TOUR_REGISTER_WEBHOOK', title: 'Tournament registration', color: 0x3b82f6, adminOnly: false },
  wallet_credited: { secret: 'DISCORD_ADD_MONEY_WEBHOOK', title: 'Wallet money added', color: 0xf59e0b, adminOnly: true },
  wallet_topup_requested: { secret: 'DISCORD_ADD_MONEY_WEBHOOK', title: 'Wallet top-up requested', color: 0xf59e0b, adminOnly: false },
  paid_tournament_fee: { secret: 'DISCORD_TOUR_FEE_WEBHOOK', title: 'Paid tournament fee', color: 0xa855f7, adminOnly: false },
};

function text(value: unknown, max = 900): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '—';
  return String(value).replace(/[\u0000-\u001f]/g, ' ').slice(0, max) || '—';
}

async function isAdminToken(token: string, env: Record<string, string | undefined>): Promise<boolean> {
  const apiKey = env.FIREBASE_API_KEY;
  if (!apiKey) return false;
  const lookupResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  });
  if (!lookupResponse.ok) return false;
  const lookup = await lookupResponse.json() as { users?: Array<{ localId?: string }> };
  const uid = lookup.users?.[0]?.localId;
  if (!uid) return false;
  const adminResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/admins/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!adminResponse.ok) return false;
  const admin = await adminResponse.json() as { fields?: { enabled?: { booleanValue?: boolean } } };
  return admin.fields?.enabled?.booleanValue === true;
}

export async function onRequestPost({ request, env }: EventContext): Promise<Response> {
  try {
    const body = await request.json() as { event?: string; data?: Record<string, unknown> };
    const config = body.event ? EVENT_CONFIG[body.event] : undefined;
    if (!config) return Response.json({ error: 'Unknown event.' }, { status: 400 });
    const webhook = env[config.secret];
    if (!webhook) return Response.json({ error: 'Webhook is not configured.' }, { status: 503 });
    if (config.adminOnly) {
      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
      if (!token || !await isAdminToken(token, env)) return Response.json({ error: 'Admin access required.' }, { status: 401 });
    }

    const data = body.data || {};
    const fields = Object.entries(data).slice(0, 20).map(([name, value]) => ({
      name: text(name, 200),
      value: text(Array.isArray(value) ? value.join(' · ') : value),
      inline: true,
    }));
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'OG x o7 Scrims Logs',
        embeds: [{ title: config.title, color: config.color, fields, timestamp: new Date().toISOString(), footer: { text: 'OG x o7 Scrims' } }],
      }),
    });
    if (!response.ok) return Response.json({ error: 'Discord webhook rejected the event.' }, { status: 502 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Could not send Discord event.' }, { status: 400 });
  }
}
