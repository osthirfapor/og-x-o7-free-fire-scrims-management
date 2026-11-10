import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Users,
  Shield,
  Check,
  Loader2,
  Gamepad2,
  RefreshCw,
  Sparkles,
  Edit2,
  ArrowUpDown,
} from 'lucide-react';
import { Tournament, Team, Player, TeamProfile } from '../types/tournament';
import { registerTeam, getLocalTeamProfile } from '../services/tournamentService';

interface Props {
  tournament: Tournament;
  onSuccess: (team: Team, tournament: Tournament) => void;
  onClose: () => void;
}

export const RegistrationModal: React.FC<Props> = ({
  tournament,
  onSuccess,
  onClose,
}) => {
  // Check saved profile for auto-refill
  const savedProfile = getLocalTeamProfile();

  const [teamName, setTeamName] = useState(savedProfile?.teamName || '');
  const [teamLogo, setTeamLogo] = useState(savedProfile?.teamLogo || '');

  // 5 Players in-game names: 4 Main Players + 1 Backup Player
  const [players, setPlayers] = useState<Player[]>(() => {
    if (savedProfile?.players && savedProfile.players.length === 5) {
      return savedProfile.players.map((p) => ({ ...p }));
    }
    return [
      { name: savedProfile?.leaderName || '', role: 'main', slotIndex: 1 },
      { name: '', role: 'main', slotIndex: 2 },
      { name: '', role: 'main', slotIndex: 3 },
      { name: '', role: 'main', slotIndex: 4 },
      { name: '', role: 'backup', slotIndex: 5 },
    ];
  });

  const [editingPlayerIndex, setEditingPlayerIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If local profile updates or loads
  useEffect(() => {
    if (savedProfile) {
      if (!teamName && savedProfile.teamName) setTeamName(savedProfile.teamName);
      if (!teamLogo && savedProfile.teamLogo) setTeamLogo(savedProfile.teamLogo);
    }
  }, [savedProfile]);

  const handlePlayerNameChange = (index: number, value: string) => {
    setPlayers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], name: value };
      return copy;
    });
  };

  // Quick swap any main player with the 5th backup player
  const handleSwapWithBackup = (mainIndex: number) => {
    const backupIndex = 4;
    setPlayers((prev) => {
      const copy = [...prev];
      const tempName = copy[mainIndex].name;
      copy[mainIndex] = { ...copy[mainIndex], name: copy[backupIndex].name };
      copy[backupIndex] = { ...copy[backupIndex], name: tempName };
      return copy;
    });
  };

  // Reset to saved profile data
  const handleResetToProfile = () => {
    if (savedProfile) {
      setTeamName(savedProfile.teamName);
      setTeamLogo(savedProfile.teamLogo);
      if (savedProfile.players?.length === 5) {
        setPlayers(savedProfile.players.map((p) => ({ ...p })));
      }
    }
  };

  const isFull = tournament.registeredCount >= tournament.maxTeams;
  const isClosed = tournament.status !== 'open';
  const remainingSlots = Math.max(0, tournament.maxTeams - tournament.registeredCount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isFull) {
      setError(`Slots full! ${tournament.maxTeams}/${tournament.maxTeams} Teams registered.`);
      return;
    }

    if (isClosed) {
      setError('Ei tournament er registration closed.');
      return;
    }

    if (!teamName.trim()) {
      setError('Team Name enter korun.');
      return;
    }

    // Check all 5 player names
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const roleLabel = p.role === 'backup' ? 'Backup Player (5th)' : `Player #${i + 1}`;
      if (!p.name.trim()) {
        setError(`${roleLabel} er In-Game Name enter korun.`);
        return;
      }
    }

    // Duplicate name check
    const names = players.map((p) => p.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      setError('Eki squad e eki player er name 2 bar deya jabe na.');
      return;
    }

    setLoading(true);
    try {
      const leaderName = players[0].name.trim();
      const { team } = await registerTeam({
        tournament,
        teamName: teamName.trim(),
        teamLogo,
        leaderName,
        players,
      });

      onSuccess(team, tournament);
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Registration failed. Check details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#141722] border border-[#262b3d] rounded-2xl shadow-2xl p-5 sm:p-6 text-white my-6 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-[#212638]">
          <div className="flex items-center gap-3">
            {teamLogo ? (
              <img
                src={teamLogo}
                alt="Team Logo"
                className="w-10 h-10 rounded-xl object-cover border border-indigo-500/40 shadow-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Gamepad2 className="text-white" size={22} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">Registration</h2>
                <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                  {tournament.category || 'Practice'}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-medium">
                {tournament.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#202536] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tournament Slot Status Compact Strip (No dropdown/selection box) */}
        <div className="mt-3 bg-[#10131c] border border-[#212638] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Map: <strong className="text-white">{tournament.map || 'Bermuda'}</strong></span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">{tournament.time}</span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                isFull
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : isClosed
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isFull ? 'SLOTS FULL' : isClosed ? 'CLOSED' : `${remainingSlots} SLOTS LEFT`}
            </span>
            <span className="text-gray-400 text-[11px]">
              {tournament.registeredCount}/{tournament.maxTeams} Teams
            </span>
          </div>
        </div>

        {/* Auto-refill Indicator */}
        {savedProfile && (
          <div className="mt-2.5 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between text-[11px] text-indigo-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles size={13} className="text-indigo-400" /> Auto-refilled from saved Team Profile
            </span>
          </div>
        )}

        {error && (
          <div className="mt-2.5 flex items-start gap-2.5 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Form Area */}
        <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 flex-1 mt-3 space-y-4">
          {/* Section 1: Team Name (Clean: No extra placeholder clutter) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-300">
                Team Name <span className="text-red-400">*</span>
              </label>
              {savedProfile && teamName !== savedProfile.teamName && (
                <button
                  type="button"
                  onClick={() => setTeamName(savedProfile.teamName)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <RefreshCw size={10} /> Reset Name
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Team Name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              disabled={isFull || isClosed}
              required
              maxLength={50}
              className="w-full bg-[#10131c] border border-[#272d42] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Section 2: Squad In-Game Names (4 Main + 1 Backup) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} /> Squad Players (In-Game Names)
              </h4>
              <span className="text-[10px] text-gray-400">Edit or Swap with 5th player</span>
            </div>

            <div className="space-y-1.5">
              {players.map((p, idx) => {
                const isLeader = idx === 0;
                const isBackup = p.role === 'backup';
                const isEditing = editingPlayerIndex === idx;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${
                      isBackup
                        ? 'bg-[#181622]/60 border-amber-500/30'
                        : isLeader
                        ? 'bg-[#131728] border-indigo-500/40'
                        : 'bg-[#10131c] border-[#22273a]'
                    }`}
                  >
                    {/* Role Tag */}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border shrink-0 w-24 text-center ${
                        isBackup
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : isLeader
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          : 'bg-gray-800 text-gray-300 border-gray-700'
                      }`}
                    >
                      {isLeader ? '👑 Leader' : isBackup ? '🔄 Backup' : `Player #${p.slotIndex}`}
                    </span>

                    {/* In-Game Name Input (Directly editable) */}
                    <input
                      type="text"
                      placeholder={
                        isLeader
                          ? 'Leader IGN'
                          : isBackup
                          ? 'Backup (5th) IGN'
                          : `Player #${p.slotIndex} IGN`
                      }
                      value={p.name}
                      onChange={(e) => handlePlayerNameChange(idx, e.target.value)}
                      disabled={isFull || isClosed}
                      required
                      maxLength={40}
                      className="flex-1 bg-[#151926] border border-[#2b324b] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                    />

                    {/* Quick Swap with Backup (Player 5) Action */}
                    {!isBackup ? (
                      <button
                        type="button"
                        onClick={() => handleSwapWithBackup(idx)}
                        title="Swap with Backup Player (5th)"
                        className="px-2 py-1 bg-[#1d2232] hover:bg-indigo-600/30 text-gray-300 hover:text-indigo-300 rounded-lg text-[10px] font-semibold border border-[#2e364e] flex items-center gap-1 transition-colors shrink-0"
                      >
                        <ArrowUpDown size={11} /> Swap P5
                      </button>
                    ) : (
                      <span className="text-[10px] text-amber-400/80 px-2 py-1 bg-amber-500/10 rounded-lg shrink-0 font-medium">
                        Sub
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-3 border-t border-[#212638] flex items-center justify-between gap-3">
            <span className="text-[11px] text-gray-400">
              Free Fire Scrims • 5 Players
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 bg-[#1e2334] hover:bg-[#272e44] text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isFull || isClosed}
                className="flex items-center justify-center gap-1.5 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Registering...
                  </>
                ) : isFull ? (
                  'Slots Full'
                ) : isClosed ? (
                  'Closed'
                ) : (
                  <>
                    <Check size={14} /> Confirm Registration
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
