import React, { useMemo, useState } from 'react';
import { Trophy, Crown, Medal, Swords, Flame, Target } from 'lucide-react';
import { MatchResult, Tournament } from '../types/tournament';
import { buildLeaderboard } from '../services/tournamentService';

interface Props {
  results: MatchResult[];
  tournaments: Tournament[];
}

const rankStyle = (rank: number) => {
  if (rank === 1) return 'from-amber-500/25 to-amber-600/5 border-amber-500/40 text-amber-300';
  if (rank === 2) return 'from-slate-300/20 to-slate-400/5 border-slate-300/30 text-slate-200';
  if (rank === 3) return 'from-orange-600/25 to-orange-700/5 border-orange-500/30 text-orange-300';
  return '';
};

export const LeaderboardView: React.FC<Props> = ({ results, tournaments }) => {
  const [scope, setScope] = useState<string>('all');

  const scoped = useMemo(
    () => (scope === 'all' ? results : results.filter((r) => r.tournamentId === scope)),
    [results, scope]
  );
  const board = useMemo(() => buildLeaderboard(scoped), [scoped]);
  const podium = board.slice(0, 3);
  const totalMatches = new Set(scoped.map((r) => r.tournamentId)).size;
  const totalWins = scoped.filter((r) => r.position === 1).length;
  const recentWinners = scoped.filter((r) => r.position === 1).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-[#282934] bg-gradient-to-br from-[#1d1a1a] via-[#131419] to-[#1b1530] p-6 sm:p-8">
        <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">
              <Trophy size={15} /> Hall of Champions
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Leaderboard</h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Kon team koita match win korse, ar overall ranking kemon.
            </p>
          </div>

          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 max-w-full"
          >
            <option value="all">All Tournaments</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative grid grid-cols-3 gap-3 mt-6">
          {[
            { label: 'Matches', value: totalMatches, icon: <Swords size={16} className="text-indigo-400" /> },
            { label: 'Booyah Wins', value: totalWins, icon: <Crown size={16} className="text-amber-400" /> },
            { label: 'Teams Ranked', value: board.length, icon: <Flame size={16} className="text-rose-400" /> },
          ].map((s) => (
            <div key={s.label} className="bg-[#0b0c10]/70 border border-[#222839] rounded-2xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                {s.icon} {s.label}
              </div>
              <div className="text-2xl font-black text-white mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {board.length === 0 ? (
        <div className="bg-[#131419] border border-[#25262f] rounded-2xl p-12 text-center text-gray-400">
          <Trophy size={40} className="mx-auto mb-3 text-gray-600" />
          <h3 className="text-base font-bold text-white mb-1">Ekhono kono result nei</h3>
          <p className="text-xs">Admin match result add korle ekhane winner & ranking dekha jabe.</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {podium.map((t, i) => (
              <div
                key={t.teamName}
                className={`relative rounded-2xl border bg-gradient-to-b p-5 text-center ${rankStyle(i + 1)} ${
                  i === 0 ? 'sm:-translate-y-2 shadow-xl shadow-amber-500/10' : ''
                }`}
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-black/30 border border-current flex items-center justify-center mb-2.5">
                  {i === 0 ? <Crown size={22} /> : <Medal size={22} />}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">#{i + 1}</div>
                <h3 className="text-lg font-black text-white truncate mt-0.5">{t.teamName}</h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-black/25 rounded-lg py-1.5">
                    <div className="text-base font-black text-white">{t.wins}</div>
                    <div className="text-gray-400">Wins</div>
                  </div>
                  <div className="bg-black/25 rounded-lg py-1.5">
                    <div className="text-base font-black text-white">{t.kills}</div>
                    <div className="text-gray-400">Kills</div>
                  </div>
                  <div className="bg-black/25 rounded-lg py-1.5">
                    <div className="text-base font-black text-white">{t.points}</div>
                    <div className="text-gray-400">Pts</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Full table */}
            <div className="xl:col-span-2 bg-[#131419] border border-[#25262f] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#20212a] text-xs font-bold uppercase tracking-wider text-gray-300">
                Full Ranking
              </div>
              <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3.5rem] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                <span>#</span>
                <span>Team</span>
                <span className="text-center">Played</span>
                <span className="text-center">Wins</span>
                <span className="text-center">Kills</span>
                <span className="text-right">Points</span>
              </div>
              <div className="divide-y divide-[#1e1f27]">
                {board.map((t, i) => (
                  <div
                    key={t.teamName}
                    className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3.5rem] gap-2 px-4 py-3 items-center text-xs hover:bg-[#1a1b23] transition-colors"
                  >
                    <span
                      className={`font-black ${
                        i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-gray-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="font-bold text-white truncate">{t.teamName}</span>
                    <span className="text-center text-gray-300">{t.matches}</span>
                    <span className="text-center font-bold text-amber-300">{t.wins}</span>
                    <span className="text-center text-gray-300">{t.kills}</span>
                    <span className="text-right font-mono font-bold text-indigo-300">{t.points}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent winners */}
            <div className="bg-[#131419] border border-[#25262f] rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-300 mb-3">
                <Target size={14} className="text-amber-400" /> Recent Match Winners
              </div>
              {recentWinners.length === 0 ? (
                <p className="text-xs text-gray-500">Kono winner record nei.</p>
              ) : (
                <div className="space-y-2">
                  {recentWinners.map((r) => (
                    <div key={r.id} className="bg-[#0d0e13] border border-[#20212a] rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                          <Crown size={13} className="text-amber-400 shrink-0" /> {r.teamName}
                        </span>
                        <span className="text-[11px] font-mono text-indigo-300">{r.points} pts</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {r.tournamentName} • {r.kills} kills
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
