import React, { useState, useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import { Team, Tournament } from '../types/tournament';

interface Props {
  teams: Team[];
  tournaments: Tournament[];
  selectedTournamentId?: string;
  onSelectTournament?: (id: string) => void;
}

interface PlayerSearchResult {
  playerName: string;
  role: 'main' | 'backup';
  slotIndex: number;
  teamName: string;
  leaderName: string;
  registrationId: string;
  status: string;
  tournamentName: string;
  tournamentDate: string;
}

export const PlayerSearchView: React.FC<Props> = ({
  teams,
  tournaments,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'main' | 'backup'>('all');

  const tourMap = useMemo(() => {
    const map = new Map<string, Tournament>();
    tournaments.forEach((t) => map.set(t.id, t));
    return map;
  }, [tournaments]);

  // Flatten all players across teams
  const allPlayers = useMemo(() => {
    const list: PlayerSearchResult[] = [];
    teams.forEach((team) => {
      const tour = tourMap.get(team.tournamentId);
      const tourName = tour ? tour.name : 'OG x o7 Scrims';
      const tourDate = tour ? `${tour.date} (${tour.time})` : '';

      if (team.players && Array.isArray(team.players)) {
        team.players.forEach((p) => {
          list.push({
            playerName: p.name,
            role: p.role,
            slotIndex: p.slotIndex,
            teamName: team.teamName,
            leaderName: team.leaderName,
            registrationId: team.registrationId,
            status: team.status,
            tournamentName: tourName,
            tournamentDate: tourDate,
          });
        });
      }
    });
    return list;
  }, [teams, tourMap]);

  // Filter based on search term & role
  const filteredPlayers = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    return allPlayers.filter((item) => {
      const matchesQuery =
        !query ||
        item.playerName.toLowerCase().includes(query) ||
        item.teamName.toLowerCase().includes(query) ||
        item.registrationId.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === 'all' || item.role === roleFilter;

      return matchesQuery && matchesRole;
    });
  }, [allPlayers, searchTerm, roleFilter]);

  return (
    <div className="space-y-5">
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-[#171b26] to-[#141722] border border-[#262c3e] rounded-2xl p-5 sm:p-7">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <Search size={15} /> Player & Team Verification
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Player Directory
          </h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Search Free Fire squads by <span className="text-gray-200 font-medium">Player In-Game Name</span> or{' '}
            <span className="text-gray-200 font-medium">Team Name</span>.
          </p>

          {/* Search Inputs */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search by Player IGN or Team Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-[#0d1017] border border-[#2b334a] p-1 rounded-xl">
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  roleFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All ({allPlayers.length})
              </button>
              <button
                onClick={() => setRoleFilter('main')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  roleFilter === 'main'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Main
              </button>
              <button
                onClick={() => setRoleFilter('backup')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  roleFilter === 'backup'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Backup
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span>
          Showing <span className="text-white font-medium">{filteredPlayers.length}</span> players across{' '}
          <span className="text-white font-medium">{teams.length}</span> registered teams
        </span>
      </div>

      {/* Results Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="bg-[#141722] border border-[#24293a] rounded-2xl p-10 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-2.5 text-gray-600" />
          <h3 className="text-base font-bold text-white mb-0.5">No Players Found</h3>
          <p className="text-xs">No registered player or squad matches your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredPlayers.map((item, idx) => {
            const isBackup = item.role === 'backup';
            return (
              <div
                key={`${item.playerName}_${idx}`}
                className="bg-[#141722] hover:bg-[#181c2a] border border-[#222739] hover:border-indigo-500/40 rounded-xl p-3.5 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        isBackup
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                      }`}
                    >
                      {isBackup ? 'Backup Player' : `Main Player #${item.slotIndex}`}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      APPROVED
                    </span>
                  </div>

                  <div className="mb-2">
                    <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {item.playerName}
                    </h4>
                  </div>

                  <div className="text-xs bg-[#10131d] rounded-lg p-2.5 border border-[#1e2333] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Team:</span>
                      <span className="font-semibold text-gray-200">{item.teamName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Leader:</span>
                      <span className="text-gray-300">{item.leaderName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Reg ID:</span>
                      <span className="font-mono text-indigo-400 text-[11px]">{item.registrationId}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#1e2333] flex items-center justify-between text-[11px] text-gray-400">
                  <span className="truncate pr-2">{item.tournamentName}</span>
                  <span className="text-gray-500 shrink-0">{item.tournamentDate.split(' ')[0]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
