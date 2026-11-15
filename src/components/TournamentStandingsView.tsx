import React, { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { MatchResult, Team, Tournament } from '../types/tournament';

interface Props {
  tournament: Tournament;
  teams: Team[];
  results: MatchResult[];
}

const GROUP_SIZE = 12;
const GROUP_THEMES = {
  lime: { accent: '#d9f75e', soft: '#e5f990', row: '#0a5734', text: '#082c1b' },
  cyan: { accent: '#67e8f9', soft: '#a5f3fc', row: '#07536b', text: '#082c1b' },
  orange: { accent: '#fb923c', soft: '#fdba74', row: '#713b16', text: '#2c1608' },
  violet: { accent: '#c4b5fd', soft: '#ddd6fe', row: '#48347b', text: '#21133d' },
} as const;

function groupLabel(index: number) {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return `GROUP-${label}`;
}

export const TournamentStandingsView: React.FC<Props> = ({ tournament, teams, results }) => {
  const publishedResults = results.filter((result) => result.tournamentId === tournament.id && result.published !== false);
  const tournamentTeams = useMemo(() => teams
    .filter((team) => team.tournamentId === tournament.id && team.status === 'approved')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id)), [teams, tournament.id]);
  const groupingEnabled = tournament.groupsEnabled === true || tournament.unlimitedGroups === true || tournament.unlimitedTeams === true;
  const teamsPerGroup = tournament.teamsPerGroup || GROUP_SIZE;
  const groupCount = groupingEnabled ? Math.max(1, Number(tournament.groupCount) || Math.ceil(tournamentTeams.length / teamsPerGroup) || 1) : 0;
  const teamGroups = useMemo(() => new Map(tournamentTeams.map((team, index) => [team.teamName.trim().toLowerCase(), groupLabel(Math.floor(index / teamsPerGroup))])), [tournamentTeams, teamsPerGroup]);
  const groups = useMemo(() => Array.from({ length: groupCount }, (_, index) => groupLabel(index)), [groupCount]);
  const matches = useMemo(() => Array.from(new Set(publishedResults.map((result) => result.mapNumber || 1))).sort((a, b) => a - b), [publishedResults]);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedMatch, setSelectedMatch] = useState(1);

  useEffect(() => {
    setSelectedGroup('all');
    setSelectedMatch(matches[0] || 1);
  }, [tournament.id]);

  useEffect(() => {
    if (!matches.includes(selectedMatch)) setSelectedMatch(matches[0] || 1);
  }, [matches, selectedMatch]);

  const themeKey = tournament.standingsTheme && tournament.standingsTheme in GROUP_THEMES
    ? tournament.standingsTheme as keyof typeof GROUP_THEMES
    : 'lime';
  const theme = GROUP_THEMES[themeKey];
  const resultsByTeam = new Map(publishedResults
    .filter((result) => (result.mapNumber || 1) === selectedMatch)
    .map((result) => [result.teamName.trim().toLowerCase(), result]));
  const rows = tournamentTeams
    .filter((team) => selectedGroup === 'all' || teamGroups.get(team.teamName.trim().toLowerCase()) === selectedGroup)
    .map((team) => ({ team, result: resultsByTeam.get(team.teamName.trim().toLowerCase()) }))
    .sort((a, b) => {
      if (a.result && b.result) return a.result.position - b.result.position || b.result.kills - a.result.kills;
      if (a.result) return -1;
      if (b.result) return 1;
      return a.team.teamName.localeCompare(b.team.teamName);
    });

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-emerald-300/15 bg-[#071b13] shadow-xl shadow-black/20 sm:mb-6 sm:rounded-3xl">
      <header className="border-b border-white/[.06] bg-gradient-to-r from-[#0d3625] via-[#0a281c] to-[#101a14] p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.2em] text-emerald-200 sm:text-[10px]"><Trophy size={13} /> Published standings</div>
            <h2 className="mt-2 truncate text-lg font-black uppercase tracking-wide text-white sm:text-2xl">{tournament.name}</h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-emerald-100/55 sm:text-xs">{selectedGroup === 'all' ? 'All groups' : selectedGroup} · Match {selectedMatch}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:max-w-md sm:flex-1 lg:max-w-lg">
            {groupingEnabled && <label className="text-[9px] font-bold uppercase tracking-wider text-emerald-100/55">Group
              <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)} className="mt-1 w-full rounded-xl border border-emerald-100/10 bg-black/25 px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-white outline-none focus:border-emerald-200/40">
                <option value="all">All groups</option>
                {groups.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>}
            <label className="text-[9px] font-bold uppercase tracking-wider text-emerald-100/55">Match
              <select value={selectedMatch} onChange={(event) => setSelectedMatch(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-emerald-100/10 bg-black/25 px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-white outline-none focus:border-emerald-200/40">
                {(matches.length ? matches : [1]).map((match) => <option key={match} value={match}>Match {match}</option>)}
              </select>
            </label>
          </div>
        </div>
      </header>

      <div className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[660px] border-separate border-spacing-y-1.5 text-left sm:border-spacing-y-2">
          <thead>
            <tr className="text-[9px] font-black uppercase tracking-wider sm:text-[10px]">
              {['#', '', 'Team name', 'Booyah', 'Kill', 'Pos.', 'Total'].map((heading, index) => <th key={`${heading}-${index}`} style={{ backgroundColor: theme.accent, color: theme.text }} className={`px-3 py-2.5 first:rounded-l-full last:rounded-r-full sm:px-4 ${heading === 'Team name' ? 'w-[38%] text-left' : 'text-center'}`}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ team, result }, index) => <tr key={team.id} className="text-xs font-extrabold sm:text-sm">
              <td style={{ backgroundColor: theme.row, color: theme.soft }} className="rounded-l-full px-3 py-2.5 text-center tabular-nums sm:px-4">{String(index + 1).padStart(2, '0')}</td>
              <td style={{ backgroundColor: theme.row, color: theme.soft }} className="px-2 py-2"><span className="mx-auto flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/25 text-[9px] font-black">{team.teamLogo ? <img src={team.teamLogo} alt="" className="h-full w-full object-cover" /> : team.teamName.trim().slice(0, 2).toUpperCase()}</span></td>
              <td style={{ backgroundColor: theme.row }} className="px-3 py-2.5 text-white sm:px-4">{team.teamName}</td>
              <td style={{ backgroundColor: theme.soft, color: theme.text }} className="px-3 py-2.5 text-center tabular-nums">{result?.position === 1 ? '01' : '—'}</td>
              <td style={{ backgroundColor: theme.row }} className="px-3 py-2.5 text-center tabular-nums text-white">{result?.kills ?? '—'}</td>
              <td style={{ backgroundColor: theme.soft, color: theme.text }} className="px-3 py-2.5 text-center tabular-nums">{result ? Math.max(0, result.points - result.kills) : '—'}</td>
              <td style={{ backgroundColor: theme.row, color: theme.soft }} className="rounded-r-full px-3 py-2.5 text-center tabular-nums sm:px-4">{result?.points ?? '—'}</td>
            </tr>)}
            {!rows.length && <tr><td colSpan={7} className="rounded-xl border border-white/[.06] bg-black/20 px-4 py-10 text-center text-xs text-slate-400">No registered teams in this group.</td></tr>}
          </tbody>
        </table>
        {!publishedResults.length && <p className="px-2 pb-2 pt-3 text-center text-[10px] text-slate-500">Organizer has not published results for this tournament yet.</p>}
      </div>
    </section>
  );
};
