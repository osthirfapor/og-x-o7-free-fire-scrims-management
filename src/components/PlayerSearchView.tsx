import React, { useMemo, useState } from 'react';
import {
  Crown,
  Search,
  Shield,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { MatchResult, Team, TeamAccount, Tournament } from '../types/tournament';

interface Props {
  teams: Team[];
  accounts: TeamAccount[];
  tournaments: Tournament[];
  matchResults: MatchResult[];
}

interface SquadPlayer {
  name: string;
  role: 'main' | 'backup';
  slotIndex: number;
  matches: number;
  wins: number;
}

interface Squad {
  key: string;
  teamName: string;
  logo?: string;
  leaderName: string;
  players: SquadPlayer[];
  matches: number;
  wins: number;
  earnings: number;
  tournaments: string[];
}

type SortMode = 'name' | 'wins' | 'matches';

const teamKey = (tournamentId: string, teamName: string) => `${tournamentId}:${teamName.trim().toLowerCase()}`;
const initials = (value: string) => value.trim().slice(0, 2).toUpperCase() || '??';

const SORT_OPTIONS: Array<{ id: SortMode; label: string }> = [
  { id: 'wins', label: 'Most wins' },
  { id: 'matches', label: 'Most matches' },
  { id: 'name', label: 'A–Z' },
];

export const PlayerSearchView: React.FC<Props> = ({ teams, accounts, tournaments, matchResults }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('wins');

  const squads = useMemo<Squad[]>(() => {
    const tournamentNames = new Map(tournaments.map((tournament) => [tournament.id, tournament.name]));
    const matchGroups = new Map<string, MatchResult[]>();
    matchResults.forEach((result) => {
      const key = teamKey(result.tournamentId, result.teamName);
      matchGroups.set(key, [...(matchGroups.get(key) || []), result]);
    });

    interface Draft extends Squad {
      seenTournaments: Set<string>;
      seenPlayerTournaments: Set<string>;
      playerMap: Map<string, SquadPlayer>;
    }
    const drafts = new Map<string, Draft>();
    accounts
      .filter((account) => account.status === 'approved' || account.status === 'pending')
      .forEach((account) => {
        const name = account.teamName.trim();
        if (!name) return;
        const key = name.toLocaleLowerCase();
        const players = (account.players || []).filter((player) => player.name.trim()).map((player) => ({ ...player, matches: 0, wins: 0 }));
        drafts.set(key, {
          key,
          teamName: name,
          logo: account.teamLogo,
          leaderName: account.leaderName,
          players,
          matches: 0,
          wins: 0,
          earnings: 0,
          tournaments: [],
          seenTournaments: new Set<string>(),
          seenPlayerTournaments: new Set<string>(),
          playerMap: new Map(players.map((player) => [player.name.toLocaleLowerCase(), player])),
        });
      });

    [...teams]
      .filter((team) => team.status === 'approved')
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      .forEach((team) => {
        const name = team.teamName.trim();
        if (!name) return;
        const key = name.toLowerCase();
        const draft = drafts.get(key) || {
          key,
          teamName: name,
          logo: undefined,
          leaderName: '',
          players: [],
          matches: 0,
          wins: 0,
          earnings: 0,
          tournaments: [],
          seenTournaments: new Set<string>(),
          seenPlayerTournaments: new Set<string>(),
          playerMap: new Map<string, SquadPlayer>(),
        };

        if (team.teamLogo) draft.logo = team.teamLogo;
        if (team.leaderName) draft.leaderName = team.leaderName;

        const teamMatches = matchGroups.get(teamKey(team.tournamentId, team.teamName)) || [];
        const teamWins = teamMatches.filter((match) => match.position === 1).length;
        const tournamentName = tournamentNames.get(team.tournamentId) || 'OG x o7 Scrims';

        if (!draft.seenTournaments.has(team.tournamentId)) {
          draft.seenTournaments.add(team.tournamentId);
          draft.matches += teamMatches.length;
          draft.wins += teamWins;
          draft.earnings += teamMatches.reduce((sum, match) => sum + Math.max(0, Number(match.earnings) || 0), 0);
          if (!draft.tournaments.includes(tournamentName)) draft.tournaments.push(tournamentName);
        }

        (team.players || []).forEach((player) => {
          const playerName = player.name.trim();
          const playerKey = playerName.toLowerCase();
          if (!playerKey) return;
          const registrationKey = `${playerKey}:${team.tournamentId}`;
          const entry = draft.playerMap.get(playerKey) || {
            name: playerName,
            role: player.role,
            slotIndex: player.slotIndex ?? 99,
            matches: 0,
            wins: 0,
          };
          if (player.role === 'main') entry.role = 'main';
          entry.slotIndex = Math.min(entry.slotIndex, player.slotIndex ?? 99);
          // A player only gets credit once per tournament even if the squad was registered twice.
          if (!draft.seenPlayerTournaments.has(registrationKey)) {
            draft.seenPlayerTournaments.add(registrationKey);
            entry.matches += teamMatches.length;
            entry.wins += teamWins;
          }
          draft.playerMap.set(playerKey, entry);
        });

        drafts.set(key, draft);
      });

    return Array.from(drafts.values()).map(({ seenTournaments, seenPlayerTournaments, playerMap, ...squad }) => ({
      ...squad,
      players: Array.from(playerMap.values()).sort(
        (a, b) => Number(a.role === 'backup') - Number(b.role === 'backup') || a.slotIndex - b.slotIndex || a.name.localeCompare(b.name),
      ),
    }));
  }, [accounts, teams, tournaments, matchResults]);

  const visiblePlayers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const list = squads.flatMap((squad) => squad.players.map((player) => ({
      ...player,
      teamName: squad.teamName,
      logo: squad.logo,
      key: `${squad.key}:${player.name.toLowerCase()}`,
    }))).filter((player) => !query
      || player.name.toLowerCase().includes(query)
      || player.teamName.toLowerCase().includes(query));

    return [...list].sort((a, b) => {
      if (sortMode === 'wins') return b.wins - a.wins || b.matches - a.matches || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (sortMode === 'matches') return b.matches - a.matches || b.wins - a.wins || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) || a.teamName.localeCompare(b.teamName, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [squads, searchTerm, sortMode]);

  const totalPlayers = squads.reduce((sum, squad) => sum + squad.players.length, 0);
  const totalMatches = squads.reduce((sum, squad) => sum + squad.matches, 0);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-[#1d1917] via-[#12141a] to-[#101921] p-4 shadow-2xl shadow-black/30 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-ember-500/15 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-56 w-56 rounded-full bg-cyan-400/[.08] blur-[90px]" />
        <div className="relative z-10 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-ember-300">
              <span className="h-px w-6 bg-gradient-to-r from-ember-400 to-amber-300" /> Competitive rankings
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Player Leaderboard</h2>
            <p className="mt-1.5 text-xs leading-5 text-zinc-400 sm:text-sm">Ranked player records from approved squads and published match results.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: 'Players', value: totalPlayers, icon: <Users size={14} className="text-cyan-300" /> },
              { label: 'Squads', value: squads.length, icon: <Shield size={14} className="text-ember-300" /> },
              { label: 'Matches', value: totalMatches, icon: <Swords size={14} className="text-amber-300" /> },
              { label: 'Player wins', value: squads.reduce((sum, squad) => sum + squad.players.reduce((playerSum, player) => playerSum + player.wins, 0), 0), icon: <Crown size={14} className="text-yellow-300" /> },
            ].map((stat) => (
              <div key={stat.label} className="min-w-0 rounded-2xl border border-white/[.07] bg-black/30 px-3 py-2.5 sm:px-4">
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.icon}{stat.label}</div>
                <div className="mt-1 text-lg font-black tabular-nums tracking-tight text-white sm:text-xl">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="search" aria-label="Search player or squad" placeholder="Search player IGN or squad…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#07080b]/80 py-3 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-ember-400/60 focus:ring-4 focus:ring-ember-500/10" />
            {searchTerm && <button type="button" aria-label="Clear search" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><X size={15} /></button>}
          </label>
          <div className="grid grid-cols-3 items-center gap-1 rounded-2xl border border-white/[.07] bg-black/30 p-1" role="group" aria-label="Sort players">
            {SORT_OPTIONS.map((option) => <button key={option.id} type="button" onClick={() => setSortMode(option.id)} className={`rounded-xl px-2.5 py-2 text-[10px] font-bold transition-all sm:px-3 sm:text-[11px] ${sortMode === option.id ? 'bg-gradient-to-r from-ember-600 to-amber-500 text-white shadow-md shadow-ember-950/50' : 'text-zinc-500 hover:text-white'}`}>{option.label}</button>)}
          </div>
        </div>
      </section>

      <div className="px-1 text-[11px] text-zinc-500"><strong className="text-zinc-200">{visiblePlayers.length}</strong> {visiblePlayers.length === 1 ? 'player' : 'players'} ranked</div>

      {visiblePlayers.length === 0 ? (
        <div className="rounded-3xl border border-white/[.07] bg-[#111218]/90 px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-ember-300/10 bg-ember-300/[.07] text-ember-200"><Users size={25} /></div>
          <h3 className="font-bold text-white">{totalPlayers ? 'No player matched that search' : 'Players are warming up'}</h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-zinc-500">{totalPlayers ? 'Try another player IGN or squad name.' : 'Approved squad players will appear here as results are recorded.'}</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {visiblePlayers.map((player, index) => (
            <li key={player.key} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/[.07] bg-[#12141b] px-3 py-3 transition-colors hover:border-ember-300/20 hover:bg-[#171922] sm:gap-4 sm:px-4">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black tabular-nums ${index === 0 ? 'bg-amber-300/15 text-amber-200' : index === 1 ? 'bg-slate-300/10 text-slate-200' : index === 2 ? 'bg-orange-300/10 text-orange-200' : 'bg-white/[.04] text-zinc-500'}`}>#{index + 1}</span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[.06] bg-black/30 text-[10px] font-black text-ember-100">{player.logo ? <img src={player.logo} alt="" className="h-full w-full object-cover" /> : initials(player.teamName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold text-white sm:text-[15px]">{player.name}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-zinc-500 sm:text-[11px]"><span className="max-w-[150px] truncate">{player.teamName}</span><span>·</span><span className={player.role === 'backup' ? 'text-amber-200' : 'text-ember-200'}>{player.role === 'backup' ? 'Backup' : 'Main'}</span></span>
              </span>
              <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                <span className="text-right"><strong className="block text-sm font-black tabular-nums text-amber-200">{player.wins}</strong><span className="text-[8px] font-bold uppercase tracking-wider text-zinc-600 sm:text-[9px]">Wins</span></span>
                <span className="text-right"><strong className="block text-sm font-black tabular-nums text-cyan-200">{player.matches}</strong><span className="text-[8px] font-bold uppercase tracking-wider text-zinc-600 sm:text-[9px]">Matches</span></span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
