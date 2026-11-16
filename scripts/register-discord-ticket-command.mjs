import 'dotenv/config';

const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!applicationId || !guildId || !botToken) {
  console.error('Set DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, and DISCORD_BOT_TOKEN before registering the command.');
  process.exit(1);
}

const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([{
    name: 'ticket',
    description: 'Open a private support ticket with the OG x o7 admin team.',
    type: 1,
    dm_permission: false,
  }]),
});

const result = await response.json().catch(() => null);
if (!response.ok) {
  console.error(`Discord rejected slash-command registration (${response.status}):`, result?.message || 'Unknown error');
  process.exit(1);
}

console.log('Registered the /ticket command in the configured support server.');
