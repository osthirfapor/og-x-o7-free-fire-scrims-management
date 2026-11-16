interface DiscordEnv {
  DISCORD_PUBLIC_KEY?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_GUILD_ID?: string;
  DISCORD_SUPPORT_ADMIN_ROLE_ID?: string;
  DISCORD_SUPPORT_CATEGORY_ID?: string;
}

interface DiscordInteraction {
  type?: number;
  id?: string;
  token?: string;
  application_id?: string;
  guild_id?: string;
  channel_id?: string;
  data?: { name?: string; custom_id?: string };
  member?: { user?: { id?: string; username?: string }; roles?: string[] };
  user?: { id?: string; username?: string };
}

const API = 'https://discord.com/api/v10';
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const READ_MESSAGE_HISTORY = 1n << 16n;
const ATTACH_FILES = 1n << 15n;
const EMBED_LINKS = 1n << 14n;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function decodeHex(value: string): Uint8Array | null {
  if (!/^[\da-f]{128}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16));
}

async function isValidDiscordSignature(request: Request, rawBody: string, publicKey: string): Promise<boolean> {
  const signature = decodeHex(request.headers.get('X-Signature-Ed25519') || '');
  const timestamp = request.headers.get('X-Signature-Timestamp') || '';
  if (!signature || !timestamp || !/^\d{1,20}$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;
  const keyBytes = decodeHex(publicKey);
  if (!keyBytes) return false;
  try {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'Ed25519' } as Algorithm, false, ['verify']);
    const message = new TextEncoder().encode(timestamp + rawBody);
    return await crypto.subtle.verify({ name: 'Ed25519' } as Algorithm, key, signature, message);
  } catch {
    return false;
  }
}

async function discordRequest(env: DiscordEnv, path: string, init: RequestInit = {}): Promise<Response> {
  if (!env.DISCORD_BOT_TOKEN) throw new Error('Discord bot is not configured yet.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bot ${env.DISCORD_BOT_TOKEN}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${API}${path}`, { ...init, headers });
}

async function readDiscordJson(response: Response): Promise<any> {
  const body = await response.json().catch(() => null) as any;
  if (!response.ok) throw new Error(body?.message || `Discord API returned ${response.status}.`);
  return body;
}

function safeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'member';
}

function memberId(interaction: DiscordInteraction): string | undefined {
  return interaction.member?.user?.id || interaction.user?.id;
}

function ticketComponents(closed = false) {
  return [{ type: 1, components: [
    { type: 2, style: 2, label: 'Claim ticket', custom_id: 'ticket_claim', disabled: closed },
    { type: 2, style: 4, label: closed ? 'Ticket closed' : 'Close ticket', custom_id: 'ticket_close', disabled: closed },
  ] }];
}

async function openTicket(interaction: DiscordInteraction, env: DiscordEnv): Promise<Response> {
  const guildId = interaction.guild_id;
  const requesterId = memberId(interaction);
  const requesterName = interaction.member?.user?.username || 'member';
  const adminRoleId = env.DISCORD_SUPPORT_ADMIN_ROLE_ID;
  if (!guildId || guildId !== env.DISCORD_GUILD_ID) return json({ type: 4, data: { content: 'Use this ticket command in the OG x o7 support server.', flags: 64 } });
  if (!requesterId || !adminRoleId) return json({ type: 4, data: { content: 'Support bot setup is incomplete. Please contact an organizer.', flags: 64 } });

  const channelsResponse = await discordRequest(env, `/guilds/${guildId}/channels`);
  const channels = await readDiscordJson(channelsResponse) as Array<{ id: string; topic?: string }>;
  const existing = channels.find((channel) => channel.topic === `ogxo7_ticket:${requesterId}:open`);
  if (existing) return json({ type: 4, data: { content: `You already have an open ticket: <#${existing.id}>`, flags: 64 } });

  const readAndWrite = VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY | ATTACH_FILES | EMBED_LINKS;
  const overwrites = [
    { id: guildId, type: 0, allow: '0', deny: VIEW_CHANNEL.toString() },
    { id: requesterId, type: 1, allow: readAndWrite.toString(), deny: '0' },
    { id: adminRoleId, type: 0, allow: readAndWrite.toString(), deny: '0' },
  ];
  const channelResponse = await discordRequest(env, `/guilds/${guildId}/channels`, {
    method: 'POST',
    body: JSON.stringify({
      name: `ticket-${safeSlug(requesterName)}`,
      type: 0,
      ...(env.DISCORD_SUPPORT_CATEGORY_ID ? { parent_id: env.DISCORD_SUPPORT_CATEGORY_ID } : {}),
      topic: `ogxo7_ticket:${requesterId}:open`,
      permission_overwrites: overwrites,
    }),
  });
  const channel = await readDiscordJson(channelResponse) as { id: string };
  const greeting = await discordRequest(env, `/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: `<@${requesterId}> Support ticket opened. Describe the issue here; only you and support admins can see this channel.`,
      allowed_mentions: { users: [requesterId] },
      components: ticketComponents(),
    }),
  });
  await readDiscordJson(greeting);
  return json({ type: 4, data: { content: `Your private support ticket is ready: <#${channel.id}>`, flags: 64 } });
}

async function handleTicketButton(interaction: DiscordInteraction, env: DiscordEnv): Promise<Response> {
  const channelId = interaction.channel_id;
  const actorId = memberId(interaction);
  const action = interaction.data?.custom_id;
  if (!channelId || !actorId) return json({ type: 4, data: { content: 'Could not identify this ticket action.', flags: 64 } });
  const channel = await readDiscordJson(await discordRequest(env, `/channels/${channelId}`)) as { id: string; guild_id?: string; name?: string; topic?: string };
  if (channel.guild_id !== env.DISCORD_GUILD_ID || !channel.topic?.startsWith('ogxo7_ticket:')) {
    return json({ type: 4, data: { content: 'This channel is not an OG x o7 ticket.', flags: 64 } });
  }
  const [, requesterId, status] = channel.topic.split(':');
  const isAdmin = Boolean(env.DISCORD_SUPPORT_ADMIN_ROLE_ID && interaction.member?.roles?.includes(env.DISCORD_SUPPORT_ADMIN_ROLE_ID));
  if (!isAdmin && actorId !== requesterId) return json({ type: 4, data: { content: 'Only the ticket owner or a support admin can use this control.', flags: 64 } });
  if (status !== 'open') return json({ type: 4, data: { content: 'This ticket is already closed.', flags: 64 } });

  if (action === 'ticket_claim') {
    if (!isAdmin) return json({ type: 4, data: { content: 'Only support admins can claim a ticket.', flags: 64 } });
    return json({ type: 4, data: { content: `Ticket claimed by <@${actorId}>.`, allowed_mentions: { users: [actorId] }, flags: 64 } });
  }
  if (action !== 'ticket_close') return json({ type: 4, data: { content: 'Unknown ticket control.', flags: 64 } });

  const readOnly = VIEW_CHANNEL | READ_MESSAGE_HISTORY;
  await readDiscordJson(await discordRequest(env, `/channels/${channelId}/permissions/${requesterId}`, {
    method: 'PUT', body: JSON.stringify({ type: 1, allow: readOnly.toString(), deny: SEND_MESSAGES.toString() }),
  }));
  await readDiscordJson(await discordRequest(env, `/channels/${channelId}`, {
    method: 'PATCH', body: JSON.stringify({ name: (channel.name || 'ticket').startsWith('closed-') ? channel.name : `closed-${(channel.name || 'ticket').slice(0, 85)}`, topic: `ogxo7_ticket:${requesterId}:closed` }),
  }));
  return json({ type: 7, data: { content: `Ticket closed by <@${actorId}>. The requester and admins can still view its history.`, allowed_mentions: { users: [actorId] }, components: ticketComponents(true) } });
}

export async function onRequestPost({ request, env }: { request: Request; env: DiscordEnv }): Promise<Response> {
  try {
    const rawBody = await request.text();
    if (!env.DISCORD_PUBLIC_KEY || !await isValidDiscordSignature(request, rawBody, env.DISCORD_PUBLIC_KEY)) {
      return json({ error: 'Invalid Discord request signature.' }, 401);
    }
    const interaction = JSON.parse(rawBody) as DiscordInteraction;
    if (interaction.type === 1) return json({ type: 1 });
    if (interaction.type === 2 && interaction.data?.name === 'ticket') return await openTicket(interaction, env);
    if (interaction.type === 3 && ['ticket_close', 'ticket_claim'].includes(interaction.data?.custom_id || '')) return await handleTicketButton(interaction, env);
    return json({ type: 4, data: { content: 'Unsupported support command.', flags: 64 } });
  } catch (error) {
    console.error('Discord ticket interaction failed:', error);
    return json({ type: 4, data: { content: 'Could not complete that ticket action. Please try again or contact an organizer.', flags: 64 } });
  }
}
