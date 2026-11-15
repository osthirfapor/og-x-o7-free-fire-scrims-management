import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Copy, MessageCircle, Users, X } from 'lucide-react';
import { Team, Tournament } from '../types/tournament';
import { openWhatsAppTab } from '../utils/openWhatsAppTab';

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
        colors: ['#ff5f1a', '#f43f45', '#ffc61f', '#10b981', '#ffc61f'],
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
  const supportWhatsAppMessage = `Hi, I need support with my tournament registration.\nRegistration ID: ${team.registrationId}\nTeam: ${team.teamName}\nTeam leader: ${team.leaderName}\nTournament: ${tournament.name}`;
  const supportWhatsAppUrl = `https://wa.me/8801937679130?text=${encodeURIComponent(supportWhatsAppMessage)}`;
  const tournamentUpdatesGroupUrl = 'https://chat.whatsapp.com/JxesDN4y8fB6QT68aygFWr';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#161922] border border-[#2c2d38] rounded-2xl shadow-2xl p-6 sm:p-7 text-white max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#22232c] transition-colors"
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

        <div role="note" className="mb-5 flex flex-col gap-2.5 rounded-xl border border-amber-300/30 bg-amber-300/[.08] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-200">Required</span><div className="text-xs font-extrabold text-white">Must join the WhatsApp group</div></div><p className="mt-1 text-[10px] leading-4 text-slate-300">Join using this link to receive future tournament updates: <span className="font-semibold text-amber-100">JxesDN4y8fB6QT68aygFWr</span></p></div>
          <a href={tournamentUpdatesGroupUrl} onClick={(event) => { event.preventDefault(); openWhatsAppTab(tournamentUpdatesGroupUrl); }} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#128c58] px-3 py-2 text-[10px] font-extrabold text-white transition hover:bg-[#16a367]"><MessageCircle size={13}/> Join required group</a>
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
          <div className="grid grid-cols-2 gap-3 text-xs bg-[#121319] p-3.5 rounded-xl border border-[#23242e]">
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
            <div className="border border-[#23242e] rounded-xl overflow-hidden divide-y divide-[#23242e]">
              {team.players.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between px-3.5 py-2 bg-[#121319] text-xs">
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

        {/* Footer Actions */}
        <div className="flex flex-col-reverse gap-2 pt-3 border-t border-[#23242e] sm:flex-row sm:justify-between">
          <a
            href={supportWhatsAppUrl}
            onClick={(event) => { event.preventDefault(); openWhatsAppTab(supportWhatsAppUrl); }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            <MessageCircle size={15} /> WhatsApp Support
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#22232c] hover:bg-[#2c2d39] text-gray-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
