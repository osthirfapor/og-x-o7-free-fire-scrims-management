import { auth } from './firebase';

export type DiscordEventName =
  | 'tournament_created'
  | 'tournament_deleted'
  | 'team_account_created'
  | 'tournament_registered'
  | 'wallet_credited'
  | 'wallet_topup_requested'
  | 'paid_tournament_fee';

const ADMIN_EVENTS = new Set<DiscordEventName>([
  'tournament_created',
  'tournament_deleted',
  'wallet_credited',
]);

export async function sendDiscordEvent(event: DiscordEventName, data: Record<string, unknown>): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ADMIN_EVENTS.has(event)) {
      const user = auth.currentUser;
      if (!user) return false;
      headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }
    const response = await fetch('/api/discord-event', {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, data }),
    });
    if (!response.ok) console.warn(`Discord ${event} log failed:`, response.status);
    return response.ok;
  } catch (error) {
    console.warn(`Discord ${event} log could not be sent:`, error);
    return false;
  }
}
