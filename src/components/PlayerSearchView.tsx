import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Crown,
  Coins,
  Search,
  Shield,
  ShieldCheck,
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
const pad = (value: number) => String(value).padStart(2, '0');
const initials = (value: string) => value.trim().slice(0, 2).toUpperCase() || '??';

const SORT_OPTIONS: Array<{ id: SortMode; label: string }> = [
  { id: 'name', label: 'A–Z' },
  { id: 'wins', label: 'Most wins' },
  { id: 'matches', label: 'Most matches' },
];

export const PlayerSearchView: React.FC<Props> = ({ teams, accounts, tournaments, matchResults }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [openKey, setOpenKey] = useState<string | null>(null);

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
    const accountTeamNames = new Set<string>();

    accounts
      .filter((account) => account.status === 'approved' || account.status === 'pending')
      .forEach((account) => {
        const name = account.teamName.trim();
        if (!name) return;
        const key = name.toLocaleLowerCase();
        accountTeamNames.add(key);
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

        if (!accountTeamNames.has(key)) (team.players || []).forEach((player) => {
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

  const visibleSquads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const list = squads.filter((squad) => !query
      || squad.teamName.toLowerCase().includes(query)
      || squad.leaderName.toLowerCase().includes(query)
      || squad.players.some((player) => player.name.toLowerCase().includes(query)));

    return [...list].sort((a, b) => {
      if (sortMode === 'wins') return b.wins - a.wins || a.teamName.localeCompare(b.teamName, undefined, { numeric: true, sensitivity: 'base' });
      if (sortMode === 'matches') return b.matches - a.matches || b.wins - a.wins || a.teamName.localeCompare(b.teamName, undefined, { numeric: true, sensitivity: 'base' });
      return a.teamName.localeCompare(b.teamName, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [squads, searchTerm, sortMode]);

  // A search that lands on exactly one squad opens it straight away.
  useEffect(() => {
    if (searchTerm.trim() && visibleSquads.length === 1) setOpenKey(visibleSquads[0].key);
  }, [searchTerm, visibleSquads]);

  const totalPlayers = squads.reduce((sum, squad) => sum + squad.players.length, 0);
  const totalMatches = squads.reduce((sum, squad) => sum + squad.matches, 0);
  const totalWins = squads.reduce((sum, squad) => sum + squad.wins, 0);
  const totalEarnings = squads.reduce((sum, squad) => sum + squad.earnings, 0);
  const query = searchTerm.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <section className="squad-hero relative overflow-hidden rounded-3xl border border-white/[.08] p-5 shadow-2xl shadow-black/30 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-ember-500/20 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-cyan-400/10 blur-[90px]" />
        <div className="relative z-10 flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-ember-300">
              <span className="h-px w-6 bg-gradient-to-r from-ember-400 to-amber-300" /> Squad roster
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Teams &amp; players</h2>
            <p className="mt-1.5 text-xs leading-5 text-zinc-400 sm:text-sm">
              Every squad account and player IGN, with match wins and earnings.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
            {[
              { label: 'Teams', value: squads.length, icon: <Shield size={14} className="text-ember-300" /> },
              { label: 'Players', value: totalPlayers, icon: <Users size={14} className="text-cyan-300" /> },
              { label: 'Matches', value: totalMatches, icon: <Swords size={14} className="text-amber-300" /> },
              { label: 'Wins', value: totalWins, icon: <Crown size={14} className="text-yellow-300" /> },
              { label: 'Earnings', value: `৳${totalEarnings.toLocaleString()}`, icon: <Coins size={14} className="text-emerald-300" /> },
            ].map((stat) => (
              <div key={stat.label} className="stat-tile min-w-[92px] rounded-2xl border border-white/[.07] bg-black/30 px-3 py-2.5 sm:px-4">
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.icon}{stat.label}</div>
                <div className="mt-1 text-lg font-black tabular-nums tracking-tight text-white sm:text-xl">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-6 flex flex-col gap-3 lg:flex-row">
          <label className="search-field relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              aria-label="Search team or player"
              placeholder="Search team or player IGN…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#07080b]/80 py-3.5 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-ember-400/60 focus:ring-4 focus:ring-ember-500/10"
            />
            {searchTerm && (
              <button type="button" aria-label="Clear search" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">
                <X size={15} />
              </button>
            )}
          </label>
          <div className="flex items-center gap-1 rounded-2xl border border-white/[.07] bg-black/30 p-1" role="group" aria-label="Sort teams">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSortMode(option.id)}
                className={`rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${sortMode === option.id ? 'bg-gradient-to-r from-ember-600 to-amber-500 text-white shadow-md shadow-ember-950/50' : 'text-zinc-500 hover:text-white'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500">
        <span><strong className="text-zinc-200">{visibleSquads.length}</strong> {visibleSquads.length === 1 ? 'team' : 'teams'} listed</span>
        {openKey && <button type="button" onClick={() => setOpenKey(null)} className="font-semibold text-ember-300 hover:text-white">Collapse all</button>}
      </div>

      {visibleSquads.length === 0 ? (
        <div className="empty-state rounded-3xl border border-white/[.07] bg-[#111218]/90 px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-ember-300/10 bg-ember-300/[.07] text-ember-200"><Users size={25} /></div>
          <h3 className="font-bold text-white">{squads.length ? 'No team or player matched that search' : 'Squads are warming up'}</h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-zinc-500">
            {squads.length ? 'Try another team name or player IGN.' : 'Squad accounts will appear here as soon as they are created.'}
          </p>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {visibleSquads.map((squad, index) => {
            const open = openKey === squad.key;
            const mainCount = squad.players.filter((player) => player.role === 'main').length;
            const backupCount = squad.players.length - mainCount;
            const panelId = `squad-panel-${squad.key.replace(/[^a-z0-9]+/g, '-')}-${index}`;

            return (
              <li
                key={squad.key}
                data-open={open}
                className="squad-row group relative overflow-hidden rounded-2xl"
                style={{ ['--i' as string]: Math.min(index, 12) } as React.CSSProperties}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenKey(open ? null : squad.key)}
                  className="relative z-10 flex w-full items-center gap-3 px-3.5 py-3 text-left sm:gap-4 sm:px-4 sm:py-3.5"
                >
                  <span className="squad-serial flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black tabular-nums sm:h-11 sm:w-11">
                    {pad(index + 1)}
                  </span>

                  <span className="squad-logo flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-black text-ember-100 sm:h-11 sm:w-11">
                    {squad.logo ? <img src={squad.logo} alt="" className="h-full w-full object-cover" /> : initials(squad.teamName)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-extrabold tracking-tight text-white transition-colors group-hover:text-ember-100 sm:text-base">{squad.teamName}</span>
                      <ShieldCheck size={13} className="hidden shrink-0 text-emerald-300 sm:block" aria-label="Verified" />
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                      {mainCount} main{backupCount ? ` · ${backupCount} backup` : ''}{squad.leaderName ? ` · Leader ${squad.leaderName}` : ''}
                    </span>
                  </span>

                  <span className="hidden items-center gap-2 sm:flex">
                    <span className="squad-chip"><Swords size={12} className="text-cyan-300" />{squad.matches}<em>{squad.matches === 1 ? 'match' : 'matches'}</em></span>
                    <span className="squad-chip"><Crown size={12} className="text-yellow-300" />{squad.wins}<em>{squad.wins === 1 ? 'win' : 'wins'}</em></span>
                  </span>

                  <ChevronDown size={18} className={`shrink-0 text-zinc-500 transition-transform duration-500 ease-out ${open ? 'rotate-180 text-ember-300' : ''}`} />
                </button>

                <div id={panelId} className="squad-panel relative z-10" inert={!open}>
                  <div className="squad-panel-inner">
                    <div className="px-3.5 pb-4 sm:px-4">
                      <div className="grid grid-cols-3 gap-2 border-t border-white/[.06] pt-4">
                        {[
                          { label: 'Matches', value: squad.matches, icon: <Swords size={13} className="text-cyan-300" /> },
                          { label: 'Wins', value: squad.wins, icon: <Crown size={13} className="text-yellow-300" /> },
                          { label: 'Earnings', value: `৳${squad.earnings.toLocaleString()}`, icon: <Coins size={13} className="text-emerald-300" /> },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-xl border border-white/[.05] bg-black/25 px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.icon}{stat.label}</div>
                            <div className="mt-1 truncate text-lg font-black tabular-nums text-white">{stat.value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[.16em] text-zinc-500">
                        <span>Roster</span>
                        <span>{squad.players.length} players</span>
                      </div>

                      <ul className="mt-2 space-y-1.5">
                        {squad.players.map((player, playerIndex) => {
                          const hit = Boolean(query) && player.name.toLowerCase().includes(query);
                          return (
                            <li
                              key={player.name}
                              className={`squad-player flex items-center gap-3 rounded-xl border px-3 py-2.5 ${hit ? 'border-ember-400/50 bg-ember-500/10' : 'border-white/[.05] bg-white/[.025]'}`}
                              style={{ ['--d' as string]: playerIndex } as React.CSSProperties}
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/40 text-[10px] font-black tabular-nums text-zinc-500">{playerIndex + 1}</span>
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${player.role === 'backup' ? 'bg-amber-400/10 text-amber-200' : 'bg-ember-500/15 text-ember-200'}`}>{initials(player.name)}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-bold text-white">{player.name}</span>
                                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${player.role === 'backup' ? 'border-amber-300/20 bg-amber-300/[.07] text-amber-200' : 'border-ember-300/20 bg-ember-300/[.07] text-ember-200'}`}>{player.role}</span>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-[10px] text-zinc-500">
                        {squad.tournaments.slice(0, 4).map((name) => <span key={name} className="rounded-md border border-white/[.06] bg-white/[.03] px-2 py-0.5 text-zinc-400">{name}</span>)}
                        {squad.tournaments.length > 4 && <span>+{squad.tournaments.length - 4} more</span>}
                        <span className="ml-auto text-zinc-600">Results appear when matches are entered.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
