import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Tournament, Team, RegistrationLog, AdminActivityLog, Player, TeamProfile, MatchResult, LeaderboardEntry } from '../types/tournament';

// Helper to generate unique Registration ID (e.g. OG7-FF-K92X81)
export function generateRegistrationId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `OG7-FF-${rand}`;
}

function teamBanDocId(teamName: string): string {
  return encodeURIComponent(teamName.trim().toLocaleLowerCase().replace(/\s+/g, ' '));
}

export async function isTeamNameBanned(teamName: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, 'banned_teams', teamBanDocId(teamName)));
  return snapshot.exists() && snapshot.data().enabled === true;
}

export async function setTeamBanned(teamName: string, enabled: boolean): Promise<void> {
  const banRef = doc(db, 'banned_teams', teamBanDocId(teamName));
  if (enabled) {
    await setDoc(banRef, {
      teamName: teamName.trim(),
      normalizedName: teamName.trim().toLocaleLowerCase().replace(/\s+/g, ' '),
      enabled: true,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await deleteDoc(banRef);
  }
}

// 1. Subscribe to Tournaments list
export function subscribeTournaments(
  onData: (tournaments: Tournament[]) => void,
  onError?: (err: any) => void
) {
  const path = 'tournaments';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snapshot) => {
      const tournaments: Tournament[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Tournament, 'id'>),
      }));
      // Sort: Open tournaments first, then by date
      tournaments.sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return a.name.localeCompare(b.name);
      });
      onData(tournaments);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// 2. Subscribe to Teams in a specific tournament
export function subscribeTeams(
  tournamentId: string,
  onData: (teams: Team[]) => void,
  onError?: (err: any) => void
) {
  const path = `tournaments/${tournamentId}/teams`;
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snapshot) => {
      const teams: Team[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Team, 'id'>),
      }));
      // Sort chronologically by registration time
      teams.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      onData(teams);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// 3. Register a Team (Simplified: Only Team Name + In-Game Names)
export async function registerTeam(params: {
  tournament: Tournament;
  teamName: string;
  teamLogo: string;
  leaderName: string;
  players: Player[]; // 4 main + optional backup
}): Promise<{ team: Team; registrationId: string }> {
  const { tournament, teamName, teamLogo, leaderName, players } = params;

  // Basic validation
  if (!teamName.trim()) throw new Error('Enter a team name.');
  if (await isTeamNameBanned(teamName)) throw new Error('This team is banned from registering. Contact the organizer.');
  if (!teamLogo?.trim()) throw new Error('Upload a team logo image.');
  const isUploadedLogo = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(teamLogo);
  let isRemoteLogo = false;
  try {
    const logoUrl = new URL(teamLogo);
    isRemoteLogo = ['http:', 'https:'].includes(logoUrl.protocol);
  } catch { /* Uploaded image data is validated separately. */ }
  if (!isUploadedLogo && !isRemoteLogo) throw new Error('Upload a valid team logo image.');
  if (isUploadedLogo && teamLogo.length > 300_000) throw new Error('Team logo is too large. Choose a smaller image.');
  if (!leaderName.trim()) throw new Error('Enter the captain in-game name.');
  if (players.length < 4 || players.length > 5) throw new Error('Add four main players and an optional backup.');

  // Every submitted player name must be present.
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const roleLabel = p.role === 'backup' ? 'Backup Player' : `Main Player ${p.slotIndex}`;
    if (!p.name.trim()) {
      throw new Error(`Enter the ${roleLabel} in-game name.`);
    }
  }

  // Prevent duplicate names inside the same team
  const names = players.map((p) => p.name.trim().toLowerCase());
  const uniqueNames = new Set(names);
  if (uniqueNames.size !== names.length) {
    throw new Error('Player names must be unique.');
  }

  const tournamentRef = doc(db, 'tournaments', tournament.id);
  const teamsColRef = collection(db, 'tournaments', tournament.id, 'teams');

  const registrationId = generateRegistrationId();
  const teamDocId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const teamRef = doc(teamsColRef, teamDocId);

  const cleanPlayerNames = players.map((p) => p.name.trim());

  // Firestore transaction to guarantee capacity limits and check duplicate names
  const resultTeam = await runTransaction(db, async (transaction) => {
    const tourSnap = await transaction.get(tournamentRef);
    if (!tourSnap.exists()) {
      throw new Error('Tournament not found.');
    }

    const tourData = tourSnap.data() as Tournament;

    if (tourData.status !== 'open') {
      throw new Error('Registration is closed.');
    }

    if (tourData.registeredCount >= tourData.maxTeams) {
      throw new Error('All team slots are full.');
    }

    // Query existing teams in this tournament to check for duplicate player names
    const existingTeamsSnap = await getDocs(teamsColRef);
    const registeredNamesSet = new Set<string>();

    existingTeamsSnap.forEach((d) => {
      const t = d.data() as Team;
      if (t.playerNames && Array.isArray(t.playerNames)) {
        t.playerNames.forEach((n) => registeredNamesSet.add(n.trim().toLowerCase()));
      } else if (t.players && Array.isArray(t.players)) {
        t.players.forEach((p) => registeredNamesSet.add(p.name.trim().toLowerCase()));
      }
    });

    for (const player of players) {
      const lowerName = player.name.trim().toLowerCase();
      if (registeredNamesSet.has(lowerName)) {
        throw new Error(`Player "${player.name}" is already registered in this tournament.`);
      }
    }

    const nowIso = new Date().toISOString();

    const newTeamData: Team = {
      id: teamDocId,
      tournamentId: tournament.id,
      registrationId,
      teamName: teamName.trim(),
      teamLogo: teamLogo?.trim() || '',
      leaderName: leaderName.trim(),
      players: players.map((p) => ({
        name: p.name.trim(),
        role: p.role,
        slotIndex: p.slotIndex,
      })),
      playerNames: cleanPlayerNames,
      status: 'approved',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextCount = (tourData.registeredCount || 0) + 1;
    const shouldClose = nextCount >= tourData.maxTeams;

    // 1. Write team document
    transaction.set(teamRef, newTeamData);

    // 2. Increment registeredCount
    transaction.update(tournamentRef, {
      registeredCount: nextCount,
      status: shouldClose ? 'closed' : tourData.status,
      updatedAt: nowIso,
    });

    return {
      newTeam: newTeamData,
      nextCount,
      maxTeams: tourData.maxTeams,
      remainingSlots: Math.max(0, tourData.maxTeams - nextCount),
    };
  });

  // Relay registration to Discord securely via server-side API
  let discordDelivered = false;
  let discordStatus: 'delivered' | 'pending' | 'failed' = 'pending';
  try {
    const notifyUrl = typeof window !== 'undefined' ? '/api/discord-notify' : 'http://localhost:3000/api/discord-notify';
    const notificationResponse = await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId,
        teamName: resultTeam.newTeam.teamName,
        leaderName: resultTeam.newTeam.leaderName,
        playerCount: cleanPlayerNames.length,
        players: cleanPlayerNames,
        registrationTime: new Date().toLocaleString(),
        currentRegisteredCount: resultTeam.nextCount,
        maxTeams: resultTeam.maxTeams,
        remainingSlots: resultTeam.remainingSlots,
        tournamentName: tournament.name,
      }),
    });
    const notificationResult = await notificationResponse.json().catch(() => ({}));
    discordDelivered = notificationResponse.ok && notificationResult.delivered === true;
    discordStatus = discordDelivered ? 'delivered' : notificationResponse.ok && notificationResult.success ? 'pending' : 'failed';
    if (!discordDelivered) console.warn('Discord relay returned an error:', notificationResponse.status);
  } catch (err) {
    console.error('Error in Discord relay call:', err);
  }

  // Record audit log
  try {
    const logId = resultTeam.newTeam.id;
    await setDoc(doc(db, 'registration_logs', logId), {
      id: logId,
      teamId: resultTeam.newTeam.id,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      registrationId,
      teamName: resultTeam.newTeam.teamName,
      leaderName: resultTeam.newTeam.leaderName,
      playerCount: cleanPlayerNames.length,
      registeredCount: resultTeam.nextCount,
      remainingSlots: resultTeam.remainingSlots,
      discordDelivered,
      discordStatus,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Could not write audit log:', e);
  }

  return { team: resultTeam.newTeam, registrationId };
}

// 4. Admin: Create a new Tournament
export async function createTournament(data: Partial<Tournament>): Promise<string> {
  const id = `scrim_${Date.now()}`;
  const now = new Date().toISOString();
  const newTour: Tournament = {
    id,
    name: data.name || 'OG x o7 Free Fire Scrims',
    game: 'Garena Free Fire',
    category: data.category || 'practice',
    date: data.date || new Date().toISOString().split('T')[0],
    time: data.time || '18:00 UTC',
    maxTeams: Number(data.maxTeams) || 12,
    registeredCount: 0,
    status: 'open',
    redirectLink: data.redirectLink ?? '',
    redirectLinkEnabled: data.redirectLinkEnabled ?? true,
    redirectButtonText: data.redirectButtonText || 'Join WhatsApp / Discord Group',
    map: data.map || 'Bermuda',
    entryFee: data.entryFee || '',
    prizePool: data.prizePool || '',
    bannerUrl: data.bannerUrl || '',
    cardImageUrl: data.cardImageUrl || '',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'tournaments', id), newTour);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `tournaments/${id}`);
  }
}

// 5. Admin: Update Tournament
export async function updateTournament(tournamentId: string, updates: Partial<Tournament>) {
  try {
    const tourRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(tourRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournamentId}`);
  }
}

// 6. Admin: Delete Tournament
export async function deleteTournament(tournamentId: string) {
  try {
    await deleteDoc(doc(db, 'tournaments', tournamentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `tournaments/${tournamentId}`);
  }
}

// 7. Admin: Update Team
export async function updateTeam(tournamentId: string, teamId: string, updates: Partial<Team>) {
  try {
    const teamRef = doc(db, 'tournaments', tournamentId, 'teams', teamId);
    await updateDoc(teamRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournamentId}/teams/${teamId}`);
  }
}

// 8. Admin: Delete Team (decrements registeredCount)
export async function deleteTeam(tournamentId: string, teamId: string) {
  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const teamRef = doc(db, 'tournaments', tournamentId, 'teams', teamId);

    await runTransaction(db, async (tx) => {
      const tourSnap = await tx.get(tournamentRef);
      if (tourSnap.exists()) {
        const tour = tourSnap.data() as Tournament;
        const newCount = Math.max(0, (tour.registeredCount || 1) - 1);
        tx.update(tournamentRef, {
          registeredCount: newCount,
          status: tour.status === 'closed' && newCount < tour.maxTeams ? 'open' : tour.status,
          updatedAt: new Date().toISOString(),
        });
      }
      tx.delete(teamRef);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `tournaments/${tournamentId}/teams/${teamId}`);
  }
}

// 9. Subscribe to Registration Logs
export function subscribeRegistrationLogs(
  onData: (logs: RegistrationLog[]) => void,
  onError?: (err: any) => void
) {
  const path = 'registration_logs';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RegistrationLog, 'id'>),
      }));
      logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(logs);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function writeAdminActivityLog(event: Omit<AdminActivityLog, 'id' | 'createdAt'>): Promise<void> {
  const id = `activity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await setDoc(doc(db, 'admin_activity_logs', id), { ...event, id, createdAt: new Date().toISOString() });
}

export function subscribeAdminActivityLogs(onData: (logs: AdminActivityLog[]) => void, onError?: (error: unknown) => void) {
  const path = 'admin_activity_logs';
  return onSnapshot(collection(db, path), (snapshot) => {
    const logs = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<AdminActivityLog, 'id'>) }));
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onData(logs);
  }, (error) => {
    onError?.(error);
    handleFirestoreError(error, OperationType.GET, path);
  });
}

// 9b. Match Results & Leaderboard
// Free Fire standard placement points (matches Rules modal)
export const PLACEMENT_POINTS: Record<number, number> = {
  1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4,
};

export function calcPoints(position: number, kills: number): number {
  return (PLACEMENT_POINTS[position] || 0) + Math.max(0, kills || 0);
}

export function subscribeMatchResults(
  onData: (results: MatchResult[]) => void,
  onError?: (err: any) => void
) {
  const q = query(collection(db, 'match_results'));
  return onSnapshot(
    q,
    (snapshot) => {
      const results = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MatchResult, 'id'>),
      }));
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(results);
    },
    (err) => {
      console.warn('Could not load match results:', err);
      if (onError) onError(err);
    }
  );
}

export async function addMatchResult(params: {
  tournamentId: string;
  tournamentName: string;
  teamName: string;
  position: number;
  kills: number;
  earnings?: number;
}): Promise<void> {
  const id = `result_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const data: MatchResult = {
    id,
    tournamentId: params.tournamentId,
    tournamentName: params.tournamentName,
    teamName: params.teamName,
    position: params.position,
    kills: params.kills,
    points: calcPoints(params.position, params.kills),
    earnings: Math.max(0, Number(params.earnings) || 0),
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'match_results', id), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `match_results/${id}`);
  }
}

export async function deleteMatchResult(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'match_results', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `match_results/${id}`);
  }
}

export function buildLeaderboard(results: MatchResult[]): LeaderboardEntry[] {
  const map = new Map<string, LeaderboardEntry>();
  results.forEach((r) => {
    const key = r.teamName.trim().toLowerCase();
    const entry = map.get(key) || { teamName: r.teamName, matches: 0, wins: 0, kills: 0, points: 0 };
    entry.matches += 1;
    entry.wins += r.position === 1 ? 1 : 0;
    entry.kills += r.kills || 0;
    entry.points += r.points || 0;
    map.set(key, entry);
  });
  return Array.from(map.values()).sort(
    (a, b) => b.wins - a.wins || b.points - a.points || b.kills - a.kills
  );
}

// 10. Team Profile Management (Auto-Refill Data for Captains)
const TEAM_PROFILE_LOCAL_KEY = 'ogxo7_captain_team_profile';

export function getLocalTeamProfile(): TeamProfile | null {
  try {
    const raw = localStorage.getItem(TEAM_PROFILE_LOCAL_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as TeamProfile;
    // Old profiles were self-created in the browser. Only keep sessions tied
    // to a squad that was registered through the admin-managed team list.
    return profile.registrationId ? profile : null;
  } catch (e) {
    console.error('Failed to parse local team profile:', e);
    return null;
  }
}

export async function saveTeamProfile(profile: TeamProfile): Promise<void> {
  localStorage.setItem(TEAM_PROFILE_LOCAL_KEY, JSON.stringify(profile));
}

export async function findRegisteredTeamProfile(teamName: string, leaderName: string): Promise<TeamProfile | null> {
  const normalizedTeam = teamName.trim().toLocaleLowerCase();
  const normalizedLeader = leaderName.trim().toLocaleLowerCase();
  const tournamentSnapshot = await getDocs(collection(db, 'tournaments'));
  const tournamentTeamSnapshots = await Promise.all(
    tournamentSnapshot.docs.map((tournamentDoc) => getDocs(collection(db, 'tournaments', tournamentDoc.id, 'teams')))
  );
  let registered: Team | undefined;
  for (const teamsSnapshot of tournamentTeamSnapshots) {
    registered = teamsSnapshot.docs
      .map((teamDoc) => ({ id: teamDoc.id, ...(teamDoc.data() as Omit<Team, 'id'>) }))
      .find((team) => {
        const leaderIgn = team.players?.find((player) => player.role === 'main' && player.slotIndex === 1)?.name || team.leaderName;
        return team.status === 'approved'
          && team.teamName.trim().toLocaleLowerCase() === normalizedTeam
          && leaderIgn.trim().toLocaleLowerCase() === normalizedLeader;
      });
    if (registered) break;
  }

  if (!registered) return null;
  if (await isTeamNameBanned(registered.teamName)) return null;
  return {
    userId: `${registered.tournamentId}_${registered.id}`,
    registrationId: registered.registrationId,
    teamName: registered.teamName,
    teamLogo: registered.teamLogo || '',
    leaderName: registered.leaderName,
    players: registered.players || [],
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchTeamProfileFromCloud(userId: string): Promise<TeamProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'team_profiles', userId));
    if (snap.exists()) {
      const data = snap.data() as TeamProfile;
      try {
        localStorage.setItem(TEAM_PROFILE_LOCAL_KEY, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (e) {
    console.warn('Could not fetch cloud profile:', e);
  }
  return getLocalTeamProfile();
}
