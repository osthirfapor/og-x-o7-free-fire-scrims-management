export interface Player {
  name: string;
  role: 'main' | 'backup';
  slotIndex: number;
}

export type TournamentCategory = 'practice' | 'free' | 'paid';

export interface TeamProfile {
  userId: string;
  registrationId?: string;
  teamName: string;
  teamLogo: string;
  leaderName: string;
  players: Player[]; // 4 Main + 1 Backup
  updatedAt: string;
}

export interface TeamAccount {
  id: string;
  teamName: string;
  teamLogo: string;
  leaderName: string;
  players: Player[];
  status: 'pending' | 'approved' | 'rejected' | 'banned';
  createdAt: string;
  updatedAt: string;
}

export interface TeamWallet {
  id: string;
  teamName: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
  lastDebit?: number;
  lastTournamentId?: string;
  lastTeamId?: string;
}

export interface Team {
  id: string;
  tournamentId: string;
  walletKey?: string;
  registrationId: string;
  teamName: string;
  teamLogo?: string;
  leaderName: string;
  players: Player[];
  playerNames: string[];
  status: 'approved' | 'pending' | 'rejected' | 'banned';
  createdAt: string;
  updatedAt?: string;
}

export interface Tournament {
  id: string;
  name: string;
  game: string;
  category: TournamentCategory;
  date: string;
  time: string;
  maxTeams: number;
  registeredCount: number;
  status: 'open' | 'closed' | 'completed';
  redirectLink: string;
  redirectLinkEnabled: boolean;
  redirectButtonText: string;
  map?: string;
  entryFee?: string;
  entryFeeAmount?: number;
  prizePool?: string;
  bannerUrl?: string;
  cardImageUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RegistrationLog {
  id: string;
  tournamentId: string;
  tournamentName: string;
  registrationId: string;
  teamName: string;
  leaderName: string;
  playerCount: number;
  registeredCount: number;
  remainingSlots: number;
  discordDelivered: boolean;
  discordStatus?: 'delivered' | 'pending' | 'failed';
  createdAt: string;
}

export interface AdminActivityLog {
  id: string;
  eventType: string;
  summary: string;
  tournamentId?: string;
  tournamentName?: string;
  teamName?: string;
  createdAt: string;
}

export interface MatchResult {
  id: string;
  tournamentId: string;
  tournamentName: string;
  teamName: string;
  position: number; // 1 = winner (Booyah)
  kills: number;
  points: number; // placement points + kills
  earnings?: number; // team payout entered by the organizer
  published?: boolean;
  publishedAt?: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  teamName: string;
  matches: number;
  wins: number;
  kills: number;
  points: number;
}

export interface AdminSettings {
  discordWebhookUrl: string;
  discordNotificationsEnabled: boolean;
  defaultRedirectUrl: string;
  defaultRedirectEnabled: boolean;
  defaultButtonText: string;
}
