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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-2 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div className="relative my-auto w-full max-w-xl overflow-y-auto rounded-2xl border border-[#2c2d38] bg-[#161922] p-3 text-white shadow-2xl [max-height:calc(100dvh-1rem)] sm:p-6 sm:[max-height:90vh] sm:p-7">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-2.5 top-2.5 z-10 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-[#22232c] hover:text-white sm:right-5 sm:top-5"
        >
          <X size={20} />
        </button>

        {/* Header Icon */}
        <div className="mb-3 text-center sm:mb-5">
          <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] sm:mb-2.5 sm:h-14 sm:w-14">
            <CheckCircle2 size={25} className="sm:hidden" /><CheckCircle2 size={32} className="hidden sm:block" />
          </div>
          <span className="inline-block px-3 py-0.5 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold rounded-full border border-emerald-500/20 mb-1.5">
            REGISTRATION CONFIRMED
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Team Registered Successfully!</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Your squad has claimed a slot in <span className="text-indigo-400 font-semibold">{tournament.name}</span>.
          </p>
        </div>

        <div role="note" className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-amber-300/30 bg-amber-300/[.08] p-2.5 sm:mb-5 sm:gap-2.5 sm:p-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-200">Required</span><div className="text-[11px] font-extrabold text-white sm:text-xs">Join the WhatsApp group</div></div><p className="mt-1 hidden text-[10px] leading-4 text-slate-300 sm:block">Join using this link to receive future tournament updates: <span className="font-semibold text-amber-100">JxesDN4y8fB6QT68aygFWr</span></p><p className="mt-1 text-[9px] text-slate-300 sm:hidden">Required for future tournament updates</p></div>
          <a href={tournamentUpdatesGroupUrl} onClick={(event) => { event.preventDefault(); openWhatsAppTab(tournamentUpdatesGroupUrl); }} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-[#128c58] px-2.5 py-2 text-[9px] font-extrabold text-white transition hover:bg-[#16a367] sm:gap-1.5 sm:px-3 sm:text-[10px]"><MessageCircle size={13}/> Join group</a>
        </div>

        {/* Registration ID Banner */}
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-[#10131c] p-2.5 sm:mb-5 sm:flex-row sm:gap-3 sm:p-3.5">
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Official Registration ID</div>
            <div className="text-base font-mono font-bold tracking-wider text-indigo-400 sm:text-xl">
              {team.registrationId}
            </div>
          </div>
          <button
            onClick={copyRegId}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-2.5 py-2 text-[10px] font-semibold text-indigo-300 transition-all hover:bg-indigo-600/30 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy ID'}
          </button>
        </div>

        {/* Team Details Summary */}
        <div className="mb-3 space-y-2.5 sm:mb-5 sm:space-y-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-[#23242e] bg-[#121319] p-2.5 text-[10px] sm:gap-3 sm:p-3.5 sm:text-xs">
            <div>
              <span className="text-gray-400">Team Name:</span>
              <p className="mt-0.5 truncate text-xs font-bold text-white sm:text-sm">{team.teamName}</p>
            </div>
            <div>
              <span className="text-gray-400">Team Leader:</span>
              <p className="mt-0.5 truncate text-xs font-bold text-white sm:text-sm">{team.leaderName}</p>
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
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:mb-2 sm:text-xs">
              <Users size={14} className="text-indigo-400" />
              Squad Players (In-Game Names)
            </div>
            <div className="border border-[#23242e] rounded-xl overflow-hidden divide-y divide-[#23242e]">
              {team.players.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 bg-[#121319] px-2.5 py-1.5 text-[10px] sm:px-3.5 sm:py-2 sm:text-xs">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase sm:px-2 sm:text-[10px] ${
                        p.role === 'backup'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : idx === 0
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      {idx === 0 ? '👑 Leader (P1)' : p.role === 'backup' ? '🔄 Backup (P5)' : `Player #${p.slotIndex}`}
                    </span>
                    <span className="truncate font-bold text-white">{p.name}</span>
                  </div>
                  <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-400 sm:px-2 sm:text-[10px]">
                    VERIFIED
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 -mx-3 -mb-3 mt-2 flex flex-row justify-between gap-2 border-t border-[#23242e] bg-[#161922]/95 p-3 pt-2 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:mt-0 sm:flex-row sm:justify-between sm:bg-transparent sm:p-0 sm:pt-3">
          <a
            href={supportWhatsAppUrl}
            onClick={(event) => { event.preventDefault(); openWhatsAppTab(supportWhatsAppUrl); }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-2 text-[10px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 sm:gap-2 sm:px-4 sm:text-xs"
          >
            <MessageCircle size={15} /> WhatsApp Support
          </a>
          <button
            onClick={onClose}
            className="rounded-xl bg-[#22232c] px-4 py-2 text-[10px] font-semibold text-gray-200 transition-colors hover:bg-[#2c2d39] hover:text-white sm:text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
