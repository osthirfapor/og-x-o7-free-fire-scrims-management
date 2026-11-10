import React, { useState } from 'react';
import {
  Users,
  Shield,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { Team, Tournament } from '../types/tournament';

interface Props {
  teams: Team[];
  tournament: Tournament;
  onRegisterClick?: () => void;
}

export const RegisteredTeamsView: React.FC<Props> = ({
  teams,
  tournament,
  onRegisterClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredTeams = teams.filter((t) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      t.teamName.toLowerCase().includes(q) ||
      t.leaderName.toLowerCase().includes(q) ||
      t.registrationId.toLowerCase().includes(q) ||
      t.players.some((p) => p.name.toLowerCase().includes(q))
    );
  });

  const copyRegId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (teamId: string) => {
    setExpandedTeamId((prev) => (prev === teamId ? null : teamId));
  };

  const remainingSlots = Math.max(0, tournament.maxTeams - tournament.registeredCount);

  return (
    <div className="space-y-5">
      {/* Tournament Overview Card */}
      <div className="bg-[#131419] border border-[#25262f] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              Garena Free Fire Scrims
            </span>
            <span className="text-xs text-gray-400">Map: {tournament.map || 'Bermuda'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {tournament.name}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Schedule: <span className="text-gray-200 font-medium">{tournament.date} at {tournament.time}</span> • Capacity: 12 Teams
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="bg-[#0d0e13] px-3.5 py-2 rounded-xl border border-[#282934] text-center">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Registered Teams</div>
            <div className="text-lg font-bold text-white">
              <span className="text-indigo-400">{teams.length}</span> / {tournament.maxTeams}
            </div>
          </div>

          {tournament.status === 'open' && remainingSlots > 0 && onRegisterClick && (
            <button
              onClick={onRegisterClick}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all"
            >
              + Register Team ({remainingSlots} Slots Left)
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search teams or player IGN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0f1015] border border-[#25262f] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="text-xs text-gray-400">
          Showing <span className="text-white font-medium">{filteredTeams.length}</span> of {teams.length} registered teams
        </div>
      </div>

      {/* Teams Grid / List */}
      {filteredTeams.length === 0 ? (
        <div className="bg-[#131419] border border-[#25262f] rounded-2xl p-10 text-center text-gray-400">
          <Shield size={36} className="mx-auto mb-2.5 text-gray-600" />
          <h3 className="text-base font-bold text-white mb-0.5">No Teams Found</h3>
          <p className="text-xs">No registered squads match your search criteria.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTeams.map((team, index) => {
            const isExpanded = expandedTeamId === team.id;
            return (
              <div
                key={team.id}
                className="bg-[#131419] border border-[#25262f] hover:border-[#2c2d38] rounded-xl overflow-hidden transition-all"
              >
                {/* Main Row */}
                <div
                  onClick={() => toggleExpand(team.id)}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[#1a1b23] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {team.teamLogo ? (
                      <img
                        src={team.teamLogo}
                        alt="Logo"
                        className="w-9 h-9 rounded-lg object-cover border border-[#2c2d38] shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                        #{index + 1}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-white">{team.teamName}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          APPROVED
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Leader: <span className="text-gray-200 font-semibold">{team.leaderName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {/* Registration ID */}
                    <div
                      onClick={(e) => copyRegId(team.registrationId, e)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0d0e13] hover:bg-[#17181f] border border-[#282934] rounded-lg text-xs font-mono text-indigo-300 transition-colors"
                      title="Copy ID"
                    >
                      <span>{team.registrationId}</span>
                      {copiedId === team.registrationId ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} className="text-gray-500 hover:text-white" />
                      )}
                    </div>

                    <button
                      type="button"
                      className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Full Squad Roster Details (IGNs only) */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-2 border-t border-[#20212a] bg-[#0f1015]/60 animate-fade-in">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                      <Users size={13} className="text-indigo-400" />
                      Squad Players (In-Game Names)
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      {team.players.map((p, idx) => {
                        const isLeader = idx === 0;
                        const isBackup = p.role === 'backup';
                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg border text-center ${
                              isBackup
                                ? 'bg-amber-500/5 border-amber-500/20 text-amber-200'
                                : isLeader
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
                                : 'bg-[#15161d] border-[#2c2d38] text-gray-200'
                            }`}
                          >
                            <div className="text-[10px] uppercase font-bold text-gray-400">
                              {isLeader ? '👑 Leader' : isBackup ? '🔄 Backup' : `Player #${p.slotIndex}`}
                            </div>
                            <div className="font-bold text-white text-xs mt-0.5 truncate">
                              {p.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-[#1d2232]">
                      <span>Registered: {new Date(team.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
