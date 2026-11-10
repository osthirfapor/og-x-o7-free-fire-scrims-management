import React, { useState } from 'react';
import {
  Shield,
  Users,
  Check,
  Copy,
  Crown,
  AlertTriangle,
  Flame,
  Gamepad2,
  X,
  Share2,
} from 'lucide-react';
import { TeamProfile, Player } from '../types/tournament';
import { saveTeamProfile, getLocalTeamProfile } from '../services/tournamentService';

interface Props {
  onLoginSuccess: (profile: TeamProfile) => void;
  isModal?: boolean;
  onClose?: () => void;
  onOpenAdminSecret?: () => void;
}

export const TeamLoginGate: React.FC<Props> = ({
  onLoginSuccess,
  isModal = false,
  onClose,
  onOpenAdminSecret,
}) => {
  const existing = getLocalTeamProfile();

  const [teamName, setTeamName] = useState(existing?.teamName || '');

  // 5 Players: 4 Main + 1 Backup
  const [p1Leader, setP1Leader] = useState(existing?.players?.[0]?.name || existing?.leaderName || '');
  const [p2, setP2] = useState(existing?.players?.[1]?.name || '');
  const [p3, setP3] = useState(existing?.players?.[2]?.name || '');
  const [p4, setP4] = useState(existing?.players?.[3]?.name || '');
  const [p5Backup, setP5Backup] = useState(existing?.players?.[4]?.name || '');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Secret admin tap counter
  const [logoTaps, setLogoTaps] = useState(0);

  const handleLogoTap = () => {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (next >= 4) {
      setLogoTaps(0);
      if (onOpenAdminSecret) onOpenAdminSecret();
    }
  };

  const handleCopyLoginLink = () => {
    const loginUrl = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(loginUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!teamName.trim()) {
      setError('Team Name enter korun.');
      return;
    }
    if (!p1Leader.trim()) {
      setError('Player 1 (Leader) In-Game Name enter korun.');
      return;
    }
    if (!p2.trim() || !p3.trim() || !p4.trim()) {
      setError('Shob 4 jon Main Player er In-Game Name enter korte hobe.');
      return;
    }
    if (!p5Backup.trim()) {
      setError('5 number Player (Backup) er In-Game Name enter korun.');
      return;
    }

    const playersList: Player[] = [
      { name: p1Leader.trim(), role: 'main', slotIndex: 1 },
      { name: p2.trim(), role: 'main', slotIndex: 2 },
      { name: p3.trim(), role: 'main', slotIndex: 3 },
      { name: p4.trim(), role: 'main', slotIndex: 4 },
      { name: p5Backup.trim(), role: 'backup', slotIndex: 5 },
    ];

    // Check duplicate names within squad
    const names = playersList.map((p) => p.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      setError('Eki squad e eki player er name multiple bar deya jabe na.');
      return;
    }

    const userId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const profile: TeamProfile = {
      userId,
      teamName: teamName.trim(),
      teamLogo: '',
      leaderName: p1Leader.trim(),
      players: playersList,
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await saveTeamProfile(profile);
      onLoginSuccess(profile);
    } catch (err: any) {
      setError('Profile save korte samasya: ' + (err.message || 'Error occurred'));
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="relative w-full max-w-xl bg-[#12151f] border border-[#262c3e] rounded-3xl shadow-2xl p-5 sm:p-8 text-white my-4 max-h-[96vh] flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="flex items-start justify-between pb-4 border-b border-[#212638]">
        <div className="flex items-center gap-3">
          <div
            onClick={handleLogoTap}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 cursor-pointer active:scale-95 transition-transform shrink-0"
          >
            <Gamepad2 className="text-white" size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">OG x o7 Scrims</h1>
              <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-red-500/20 text-red-300 border border-red-500/40 rounded-full">
                Free Fire
              </span>
            </div>
            <p className="text-xs text-gray-400 font-medium">
              Captain & Squad Login Gate • Auto-Refill System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Login Link Button */}
          <button
            type="button"
            onClick={handleCopyLoginLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1f2e] hover:bg-indigo-600/30 text-indigo-300 hover:text-white rounded-xl text-xs font-bold border border-[#2b334d] transition-all shadow-sm"
            title="Copy Login Link to share with other squad captains"
          >
            {copiedLink ? (
              <>
                <Check size={14} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Login Link</span>
              </>
            )}
          </button>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-[#202536] transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      <div className="mt-3.5 p-3 bg-gradient-to-r from-indigo-900/30 via-[#181d2c] to-purple-900/30 border border-indigo-500/30 rounded-2xl text-xs text-gray-300 flex items-center gap-2.5">
        <Flame size={18} className="text-indigo-400 shrink-0" />
        <div>
          <span className="font-bold text-white">Login Required:</span> Enter your Team Name and 5 Player IGNs (4 Main + 1 Backup) to unlock all tournaments and auto-refill registrations!
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-center gap-2.5">
          <AlertTriangle size={16} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 flex-1 mt-4 space-y-4">
        {/* Team Name */}
        <div>
          <label className="block text-xs font-bold text-gray-200 mb-1.5">
            Team Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="Enter Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
            maxLength={50}
            className="w-full bg-[#0d1017] border border-[#272d42] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* 5 Players Roster (4 Main + 1 Backup) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} /> Squad Players (In-Game Names)
            </label>
            <span className="text-[10px] text-gray-400">4 Main + 1 Backup</span>
          </div>

          {/* Player 1 (Leader) */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#131728] border border-indigo-500/40">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 w-28 text-center flex items-center justify-center gap-1">
              <Crown size={12} /> Leader (P1)
            </span>
            <input
              type="text"
              placeholder="Leader In-Game Name"
              value={p1Leader}
              onChange={(e) => setP1Leader(e.target.value)}
              required
              maxLength={40}
              className="flex-1 bg-[#0d1017] border border-[#2b324b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Player 2 */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0d1017] border border-[#22273a]">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700 shrink-0 w-28 text-center">
              Player #2
            </span>
            <input
              type="text"
              placeholder="Player 2 In-Game Name"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              required
              maxLength={40}
              className="flex-1 bg-[#141824] border border-[#2b324b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Player 3 */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0d1017] border border-[#22273a]">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700 shrink-0 w-28 text-center">
              Player #3
            </span>
            <input
              type="text"
              placeholder="Player 3 In-Game Name"
              value={p3}
              onChange={(e) => setP3(e.target.value)}
              required
              maxLength={40}
              className="flex-1 bg-[#141824] border border-[#2b324b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Player 4 */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0d1017] border border-[#22273a]">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700 shrink-0 w-28 text-center">
              Player #4
            </span>
            <input
              type="text"
              placeholder="Player 4 In-Game Name"
              value={p4}
              onChange={(e) => setP4(e.target.value)}
              required
              maxLength={40}
              className="flex-1 bg-[#141824] border border-[#2b324b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Player 5 (Backup Player) */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#181622]/70 border border-amber-500/30">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 w-28 text-center">
              🔄 Backup (P5)
            </span>
            <input
              type="text"
              placeholder="5th Backup Player In-Game Name"
              value={p5Backup}
              onChange={(e) => setP5Backup(e.target.value)}
              required
              maxLength={40}
              className="flex-1 bg-[#141824] border border-[#2b324b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Footer Submit */}
        <div className="pt-3 border-t border-[#212638] flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-gray-400 text-center sm:text-left">
            ⚡ 1-Click Auto-Refill for all Free Fire Scrims
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isModal && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1a1f2e] hover:bg-[#252c40] text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-7 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg shadow-indigo-600/30 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? 'Logging in...' : '🚀 Login & Enter Tournaments'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fade-in overflow-y-auto">
        {content}
      </div>
    );
  }

  // Full-screen Gatekeeper
  return (
    <div className="min-h-screen bg-[#0b0e14] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))] flex flex-col items-center justify-center p-3 sm:p-6 select-none">
      {content}
    </div>
  );
};
