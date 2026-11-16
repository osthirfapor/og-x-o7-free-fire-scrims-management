# Discord support tickets

The site support shortcut opens the OG x o7 Discord server. Members create a ticket there with `/ticket`. The interaction endpoint creates a private text channel visible to the requester and the configured support-admin role. Each requester can have one open ticket. Admins can claim it; the requester or an admin can close it. Closing locks the requester from sending while leaving the channel and its history available to the requester and admins.

## Discord application setup

1. Create a Discord application and add its bot user in the Developer Portal.
2. Copy the application's **Application ID**, **Public Key**, and the bot's **Token**. Keep the bot token secret; never put it in Vite client variables or commit it.
3. In **Installation**, enable guild install and include the `bot` and `applications.commands` scopes. Request only the permissions needed for the features you enable. Tickets need Manage Channels, View Channels, Send Messages, Read Message History, Embed Links, and Attach Files. Tournament-role automation also needs Manage Roles; keep the bot's highest role above the tournament roles it manages.
4. In **Interactions Endpoint URL**, set `https://og-x-o7-free-fire-scrims.pages.dev/api/discord-interactions` after the Pages deployment is live, and save. Discord validates this URL with a signed ping request.
5. Invite the bot to the support guild and create a support-admin role. Assign that role only to organizers. Optionally create a ticket category.
6. Set these as Cloudflare Pages production secrets/variables (also set them locally in `.env` for local work): `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, and `DISCORD_SUPPORT_ADMIN_ROLE_ID`. `DISCORD_SUPPORT_CATEGORY_ID` is optional. Find IDs by enabling Developer Mode in Discord and using **Copy Server ID**, **Copy Role ID**, and **Copy Channel ID**.
7. Run `npm run discord:register-ticket` once with `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID`, and `DISCORD_BOT_TOKEN` configured. This registers `/ticket` in the support server.

The bot must be in the guild and have the configured support role ID. Tickets are private through Discord channel permission overwrites; the bot does not grant public channel access. Do not expose `DISCORD_BOT_TOKEN` or any future OAuth client secret in browser code.
