import React, { useMemo, useState } from 'react';
import { Crown, DollarSign, Search, ShieldCheck, Swords, Trophy, Users } from 'lucide-react';
import { MatchResult, Team, Tournament } from '../types/tournament';

interface Props {
  teams: Team[];
  tournaments: Tournament[];
  matchResults: MatchResult[];
}

interface PlayerDirectoryEntry {
  playerName: string;
  roles: Array<'main' | 'backup'>;
  teams: string[];
  registrations: number;
  matches: number;
  wins: number;
  earnings: number;
  tournaments: string[];
}

const teamKey = (tournamentId: string, teamName: string) => `${tournamentId}:${teamName.trim().toLowerCase()}`;

export const PlayerSearchView: React.FC<Props> = ({ teams, tournaments, matchResults }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'main' | 'backup'>('all');

  const players = useMemo(() => {
    const tournamentNames = new Map(tournaments.map((tournament) => [tournament.id, tournament.name]));
    const matchGroups = new Map<string, MatchResult[]>();
    matchResults.forEach((result) => {
      const key = teamKey(result.tournamentId, result.teamName);
      matchGroups.set(key, [...(matchGroups.get(key) || []), result]);
    });

    const directory = new Map<string, PlayerDirectoryEntry>();
    const countedRegistrations = new Set<string>();

    teams.filter((team) => team.status === 'approved').forEach((team) => {
      const registrationKey = `${team.tournamentId}:${team.id}`;
      const teamMatches = matchGroups.get(teamKey(team.tournamentId, team.teamName)) || [];
      const tournamentName = tournamentNames.get(team.tournamentId) || 'OG x o7 Scrims';

      (team.players || []).forEach((player) => {
        const playerKey = player.name.trim().toLowerCase();
        if (!playerKey) return;
        const entry = directory.get(playerKey) || {
          playerName: player.name.trim(),
          roles: [],
          teams: [],
          registrations: 0,
          matches: 0,
          wins: 0,
          earnings: 0,
          tournaments: [],
        };

        if (!entry.roles.includes(player.role)) entry.roles.push(player.role);
        if (!entry.teams.includes(team.teamName)) entry.teams.push(team.teamName);
        if (!countedRegistrations.has(`${playerKey}:${registrationKey}`)) {
          countedRegistrations.add(`${playerKey}:${registrationKey}`);
          entry.registrations += 1;
          entry.matches += teamMatches.length;
          entry.wins += teamMatches.filter((match) => match.position === 1).length;
          entry.earnings += teamMatches.reduce((sum, match) => sum + Math.max(0, Number(match.earnings) || 0), 0);
        }
        if (!entry.tournaments.includes(tournamentName)) entry.tournaments.push(tournamentName);
        directory.set(playerKey, entry);
      });
    });

    return Array.from(directory.values()).sort((a, b) =>
      b.earnings - a.earnings || b.wins - a.wins || a.playerName.localeCompare(b.playerName)
    );
  }, [teams, tournaments, matchResults]);

  const filteredPlayers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return players.filter((player) => {
      const matchesQuery = !query || player.playerName.toLowerCase().includes(query)
        || player.teams.some((team) => team.toLowerCase().includes(query));
      const matchesRole = roleFilter === 'all' || player.roles.includes(roleFilter);
      return matchesQuery && matchesRole;
    });
  }, [players, searchTerm, roleFilter]);

  const totalEarnings = players.reduce((sum, player) => sum + player.earnings, 0);
  const totalWins = players.reduce((sum, player) => sum + player.wins, 0);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/[.09] bg-gradient-to-br from-[#151b2a] via-[#10141e] to-[#121020] p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-indigo-500/15 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-[90px]" />
        <div className="relative z-10 flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-200">
              <Search size={14} /> Competitive intelligence
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Player directory</h2>
            <p className="mt-1.5 text-xs leading-5 text-slate-400 sm:text-sm">
              Search any registered IGN to see squad history, match form, Booyahs and team prize earnings.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Players', value: players.length, icon: <Users size={14} className="text-indigo-300" /> },
              { label: 'Booyahs', value: totalWins, icon: <Crown size={14} className="text-amber-300" /> },
              { label: 'Team earnings', value: `৳${totalEarnings.toLocaleString()}`, icon: <DollarSign size={14} className="text-emerald-300" /> },
            ].map((stat) => (
              <div key={stat.label} className="stat-tile min-w-[92px] rounded-2xl border border-white/[.07] bg-black/20 px-3 py-2.5 sm:min-w-[112px] sm:px-4">
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">{stat.icon}{stat.label}</div>
                <div className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-6 flex flex-col gap-3 lg:flex-row">
          <label className="search-field relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              aria-label="Search player or team"
              placeholder="Search player IGN or team name…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#090d15]/80 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/10"
            />
          </label>
          <div className="flex items-center gap-1 rounded-2xl border border-white/[.07] bg-black/20 p-1">
            {[
              { id: 'all', label: `All · ${players.length}` },
              { id: 'main', label: 'Main' },
              { id: 'backup', label: 'Backup' },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setRoleFilter(filter.id as typeof roleFilter)}
                className={`rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${roleFilter === filter.id ? 'bg-indigo-500 text-white shadow-md shadow-indigo-950/40' : 'text-slate-500 hover:text-white'}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
        <span><strong className="text-slate-200">{filteredPlayers.length}</strong> player records · {teams.filter((team) => team.status === 'approved').length} approved squad registrations</span>
        {searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="font-semibold text-indigo-300 hover:text-white">Clear search</button>}
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="empty-state rounded-3xl border border-white/[.07] bg-[#111621]/90 px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/10 bg-indigo-300/[.07] text-indigo-200"><Users size={25} /></div>
          <h3 className="font-bold text-white">{players.length ? 'No player matched that search' : 'Player stats are warming up'}</h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500">
            {players.length ? 'Try another IGN or team name.' : 'Approved registrations appear here. Match and earnings numbers update as organizers add results.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 2xl:grid-cols-3">
          {filteredPlayers.map((player, index) => (
            <article key={player.playerName.toLowerCase()} className="player-card group relative overflow-hidden rounded-2xl border border-white/[.08] bg-gradient-to-br from-[#151a27] to-[#0f131c] p-4 transition duration-300 hover:-translate-y-1 hover:border-indigo-300/30 hover:shadow-xl hover:shadow-indigo-950/25" style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}>
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-indigo-500/[.06] blur-2xl transition group-hover:bg-indigo-400/[.14]" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="player-avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-300/15 bg-gradient-to-br from-indigo-500/20 to-cyan-300/10 text-sm font-black text-indigo-100">
                    {player.playerName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-extrabold text-white transition-colors group-hover:text-cyan-100">{player.playerName}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {player.roles.map((role) => (
                        <span key={role} className={`rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${role === 'backup' ? 'border-amber-300/15 bg-amber-300/[.06] text-amber-200' : 'border-indigo-300/15 bg-indigo-300/[.06] text-indigo-200'}`}>{role}</span>
                      ))}
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300"><ShieldCheck size={11} /> Verified</span>
                    </div>
                  </div>
                </div>
                <Trophy size={15} className="mt-1 shrink-0 text-amber-300/70" />
              </div>

              <div className="relative z-10 mt-4 flex min-h-7 flex-wrap gap-1.5">
                {player.teams.slice(0, 3).map((team) => <span key={team} className="max-w-full truncate rounded-lg border border-white/[.07] bg-white/[.035] px-2 py-1 text-[10px] font-semibold text-slate-300">{team}</span>)}
                {player.teams.length > 3 && <span className="rounded-lg bg-white/[.035] px-2 py-1 text-[10px] text-slate-500">+{player.teams.length - 3}</span>}
              </div>

              <div className="relative z-10 mt-4 grid grid-cols-4 gap-1.5 border-t border-white/[.06] pt-3">
                {[
                  { label: 'Registered', value: player.registrations, icon: <Users size={12} className="text-indigo-300" /> },
                  { label: 'Matches', value: player.matches, icon: <Swords size={12} className="text-cyan-300" /> },
                  { label: 'Wins', value: player.wins, icon: <Crown size={12} className="text-amber-300" /> },
                  { label: 'Earnings*', value: `৳${player.earnings.toLocaleString()}`, icon: <DollarSign size={12} className="text-emerald-300" /> },
                ].map((stat) => (
                  <div key={stat.label} className="min-w-0 rounded-xl bg-black/20 px-1.5 py-2 text-center">
                    <div className="flex items-center justify-center">{stat.icon}</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{stat.value}</div>
                    <div className="truncate text-[8px] font-bold uppercase tracking-wide text-slate-600">{stat.label}</div>
                  </div>
                ))}
              </div>
              <p className="relative z-10 mt-2 text-[9px] text-slate-600">*Shared total prize money recorded for listed squads.</p>
              <div className="relative z-10 mt-2 truncate text-[10px] text-slate-500">{player.tournaments.slice(0, 2).join(' · ')}{player.tournaments.length > 2 ? ` · +${player.tournaments.length - 2} more` : ''}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
