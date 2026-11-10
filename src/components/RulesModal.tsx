import React from 'react';
import { X, BookOpen, Trophy, ShieldAlert, Award } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const RulesModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#141722] border border-[#262c3e] rounded-2xl shadow-2xl p-6 sm:p-8 text-white max-h-[88vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#202536]"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold">OG x o7 Scrims Rules & Scoring</h2>
            <p className="text-xs text-gray-400">Official Garena Free Fire Tournament Regulations</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-gray-300">
          <div className="bg-[#0f121a] p-4 rounded-xl border border-[#212638]">
            <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" /> Free Fire Standard Point System
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1 font-mono">
              <div className="p-2 bg-[#171b26] rounded-lg">1st: 12 pts</div>
              <div className="p-2 bg-[#171b26] rounded-lg">2nd: 9 pts</div>
              <div className="p-2 bg-[#171b26] rounded-lg">3rd: 8 pts</div>
              <div className="p-2 bg-[#171b26] rounded-lg">4th: 7 pts</div>
              <div className="p-2 bg-[#171b26] rounded-lg">5th: 6 pts</div>
              <div className="p-2 bg-[#171b26] rounded-lg">6th: 5 pts</div>
              <div className="p-2 bg-[#171b26] rounded-lg">7th: 4 pts</div>
              <div className="p-2 bg-[#171b26] rounded-lg">Kill: 1 pt each</div>
            </div>
          </div>

          <div className="bg-[#0f121a] p-4 rounded-xl border border-[#212638] space-y-2">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <ShieldAlert size={16} className="text-indigo-400" /> Team & Player Rules
            </h3>
            <ul className="list-disc pl-4 space-y-1">
              <li>Each team must register 4 Main Players + 1 Backup Player (5 players total).</li>
              <li>A player UID cannot be registered across multiple teams in the same scrim.</li>
              <li>Maximum 12 teams (60 players) per lobby.</li>
              <li>Mobile devices only. Emulators or PC scripts are strictly prohibited.</li>
              <li>Room ID and Password are sent 15 minutes before match time via the official link.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
