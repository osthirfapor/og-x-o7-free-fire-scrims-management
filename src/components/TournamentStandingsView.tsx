import React, { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { MatchResult, Team, Tournament } from '../types/tournament';

interface Props {
  tournament: Tournament;
  teams: Team[];
  results: MatchResult[];
  myGroupName?: string;
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

export const TournamentStandingsView: React.FC<Props> = ({ tournament, teams, results, myGroupName }) => {
  const publishedResults = results.filter((result) => result.tournamentId === tournament.id && result.published !== false);
  const tournamentTeams = useMemo(() => teams
    .filter((team) => team.tournamentId === tournament.id && team.status === 'approved')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id)), [teams, tournament.id]);
  const groupingEnabled = tournament.groupsEnabled === true || tournament.unlimitedGroups === true || tournament.unlimitedTeams === true;
  const teamsPerGroup = tournament.teamsPerGroup || GROUP_SIZE;
  const groupCount = groupingEnabled ? Math.max(1, Math.ceil(tournamentTeams.length / teamsPerGroup), tournament.unlimitedGroups || tournament.unlimitedTeams ? 0 : Number(tournament.groupCount) || 0) : 0;
  const teamGroups = useMemo(() => new Map(tournamentTeams.map((team, index) => [team.teamName.trim().toLowerCase(), groupLabel(Math.floor(index / teamsPerGroup))])), [tournamentTeams, teamsPerGroup]);
  const groups = useMemo(() => Array.from({ length: groupCount }, (_, index) => groupLabel(index)), [groupCount]);
  const [selectedGroup, setSelectedGroup] = useState(myGroupName || 'all');

  useEffect(() => {
    setSelectedGroup(myGroupName || 'all');
  }, [tournament.id, myGroupName]);

  const themeKey = tournament.standingsTheme && tournament.standingsTheme in GROUP_THEMES
    ? tournament.standingsTheme as keyof typeof GROUP_THEMES
    : 'lime';
  const theme = GROUP_THEMES[themeKey];
  const resultsByTeam = new Map<string, { booyah: number; kills: number; positionPoints: number; total: number; matches: number }>();
  publishedResults
    .forEach((result) => {
      const key = result.teamName.trim().toLowerCase();
      const totals = resultsByTeam.get(key) || { booyah: 0, kills: 0, positionPoints: 0, total: 0, matches: 0 };
      totals.booyah += result.position === 1 ? 1 : 0;
      totals.kills += result.kills || 0;
      totals.positionPoints += Math.max(0, (result.points || 0) - (result.kills || 0));
      totals.total += result.points || 0;
      totals.matches += 1;
      resultsByTeam.set(key, totals);
    });
  const rows = tournamentTeams
    .filter((team) => selectedGroup === 'all' || teamGroups.get(team.teamName.trim().toLowerCase()) === selectedGroup)
    .map((team) => ({ team, result: resultsByTeam.get(team.teamName.trim().toLowerCase()) }))
    .sort((a, b) => {
      if (a.result && b.result) return b.result.total - a.result.total || b.result.booyah - a.result.booyah || b.result.kills - a.result.kills;
      if (a.result) return -1;
      if (b.result) return 1;
      return a.team.teamName.localeCompare(b.team.teamName);
    });
  const displayedMatchCount = new Set(publishedResults
    .filter((result) => selectedGroup === 'all' || teamGroups.get(result.teamName.trim().toLowerCase()) === selectedGroup)
    .map((result) => result.mapNumber || 1)).size;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-emerald-300/15 bg-[#071b13] shadow-xl shadow-black/20 sm:mb-6 sm:rounded-3xl">
      <header className="border-b border-white/[.06] bg-gradient-to-r from-[#0d3625] via-[#0a281c] to-[#101a14] p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.2em] text-emerald-200 sm:text-[10px]"><Trophy size={13} /> Published standings</div>
            <h2 className="mt-2 truncate text-lg font-black uppercase tracking-wide text-white sm:text-2xl">{tournament.name}</h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-emerald-100/55 sm:text-xs">{selectedGroup === 'all' ? 'All groups' : selectedGroup} · Overall · {displayedMatchCount} matches</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:max-w-md sm:flex-1 lg:max-w-lg">
            {groupingEnabled && myGroupName && <div className="flex items-center justify-between rounded-xl border border-violet-200/15 bg-violet-200/[.06] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-violet-100"><span>Your group</span><span className="text-xs font-black">{myGroupName}</span></div>}
            {groupingEnabled && !myGroupName && <label className="text-[9px] font-bold uppercase tracking-wider text-emerald-100/55">Group
              <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)} className="mt-1 w-full rounded-xl border border-emerald-100/10 bg-black/25 px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-white outline-none focus:border-emerald-200/40">
                <option value="all">All groups</option>
                {groups.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>}
          </div>
        </div>
      </header>

      <div className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-left sm:border-spacing-y-2">
          <thead>
            <tr className="text-[9px] font-black uppercase tracking-wider sm:text-[10px]">
              {['#', '', 'Team name', 'Booyah', 'Kill', 'Pos.', 'Matches', 'Total'].map((heading, index) => <th key={`${heading}-${index}`} style={{ backgroundColor: theme.accent, color: theme.text }} className={`px-3 py-2.5 first:rounded-l-full last:rounded-r-full sm:px-4 ${heading === 'Team name' ? 'w-[34%] text-left' : 'text-center'}`}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ team, result }, index) => <tr key={team.id} className="text-xs font-extrabold sm:text-sm">
              <td style={{ backgroundColor: theme.row, color: theme.soft }} className="rounded-l-full px-3 py-2.5 text-center tabular-nums sm:px-4">{String(index + 1).padStart(2, '0')}</td>
              <td style={{ backgroundColor: theme.row, color: theme.soft }} className="px-2 py-2"><span className="mx-auto flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/25 text-[9px] font-black">{team.teamLogo ? <img src={team.teamLogo} alt="" className="h-full w-full object-cover" /> : team.teamName.trim().slice(0, 2).toUpperCase()}</span></td>
              <td style={{ backgroundColor: theme.row }} className="px-3 py-2.5 text-white sm:px-4"><div>{team.teamName}</div><div style={{ color: theme.soft }} className="mt-0.5 text-[8px] font-bold uppercase tracking-wider sm:text-[9px]">{result ? `${result.booyah} Booyah · ${result.matches} maps` : 'No published result'}</div></td>
              <td style={{ backgroundColor: theme.soft, color: theme.text }} className="px-3 py-2.5 text-center tabular-nums">{result ? result.booyah : '—'}</td>
              <td style={{ backgroundColor: theme.row }} className="px-3 py-2.5 text-center tabular-nums text-white">{result?.kills ?? '—'}</td>
              <td style={{ backgroundColor: theme.soft, color: theme.text }} className="px-3 py-2.5 text-center tabular-nums">{result ? result.positionPoints : '—'}</td>
              <td style={{ backgroundColor: theme.row, color: theme.soft }} className="px-3 py-2.5 text-center tabular-nums">{result?.matches ?? '—'}</td>
              <td style={{ backgroundColor: theme.row, color: theme.soft }} className="rounded-r-full px-3 py-2.5 text-center tabular-nums sm:px-4">{result?.total ?? '—'}</td>
            </tr>)}
            {!rows.length && <tr><td colSpan={8} className="rounded-xl border border-white/[.06] bg-black/20 px-4 py-10 text-center text-xs text-slate-400">No registered teams in this group.</td></tr>}
          </tbody>
        </table>
        {!publishedResults.length && <p className="px-2 pb-2 pt-3 text-center text-[10px] text-slate-500">Organizer has not published results for this tournament yet.</p>}
      </div>
    </section>
  );
};
