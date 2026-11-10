import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Copy, ExternalLink, Users, X } from 'lucide-react';
import { Team, Tournament } from '../types/tournament';

interface Props {
  team: Team;
  tournament: Tournament;
  onClose: () => void;
}

export const RegistrationSuccessModal: React.FC<Props> = ({ team, tournament, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b'],
      });
    } catch (e) {
      // Ignored if canvas unsupported
    }
  }, []);

  const copyRegId = () => {
    navigator.clipboard.writeText(team.registrationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRedirect = () => {
    if (tournament.redirectLink) {
      window.open(tournament.redirectLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#161922] border border-[#262b3d] rounded-2xl shadow-2xl p-6 sm:p-7 text-white max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#202536] transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header Icon */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2.5 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle2 size={32} />
          </div>
          <span className="inline-block px-3 py-0.5 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold rounded-full border border-emerald-500/20 mb-1.5">
            REGISTRATION CONFIRMED
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Team Registered Successfully!</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Your squad has claimed a slot in <span className="text-indigo-400 font-semibold">{tournament.name}</span>.
          </p>
        </div>

        {/* Registration ID Banner */}
        <div className="bg-[#10131c] border border-indigo-500/30 rounded-xl p-3.5 mb-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Official Registration ID</div>
            <div className="text-xl font-mono font-bold text-indigo-400 tracking-wider">
              {team.registrationId}
            </div>
          </div>
          <button
            onClick={copyRegId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold transition-all"
          >
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy ID'}
          </button>
        </div>

        {/* Team Details Summary */}
        <div className="space-y-4 mb-5">
          <div className="grid grid-cols-2 gap-3 text-xs bg-[#12151f] p-3.5 rounded-xl border border-[#212638]">
            <div>
              <span className="text-gray-400">Team Name:</span>
              <p className="font-bold text-white text-sm mt-0.5">{team.teamName}</p>
            </div>
            <div>
              <span className="text-gray-400">Team Leader:</span>
              <p className="font-bold text-white text-sm mt-0.5">{team.leaderName}</p>
            </div>
            <div>
              <span className="text-gray-400">Tournament:</span>
              <p className="font-medium text-gray-200 mt-0.5">{tournament.name}</p>
            </div>
            <div>
              <span className="text-gray-400">Schedule:</span>
              <p className="font-medium text-gray-200 mt-0.5">{tournament.date} ({tournament.time})</p>
            </div>
          </div>

          {/* Roster (IGNs only) */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              <Users size={14} className="text-indigo-400" />
              Squad Players (In-Game Names)
            </div>
            <div className="border border-[#212638] rounded-xl overflow-hidden divide-y divide-[#212638]">
              {team.players.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between px-3.5 py-2 bg-[#12151f] text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        p.role === 'backup'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : idx === 0
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      {idx === 0 ? '👑 Leader (P1)' : p.role === 'backup' ? '🔄 Backup (P5)' : `Player #${p.slotIndex}`}
                    </span>
                    <span className="font-bold text-white">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                    VERIFIED
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Registration Redirect Link Section */}
        {tournament.redirectLinkEnabled && tournament.redirectLink && (
          <div className="mb-5 p-3.5 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-950/40 border border-indigo-500/30 rounded-xl text-center">
            <p className="text-[11px] text-indigo-200 mb-2">
              Next Step: Join the official tournament WhatsApp/Discord group for room ID and password:
            </p>
            <button
              onClick={handleRedirect}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-xs"
            >
              <ExternalLink size={15} />
              {tournament.redirectButtonText || 'Open Group Link'}
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end pt-3 border-t border-[#212638]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#202536] hover:bg-[#282f45] text-gray-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
