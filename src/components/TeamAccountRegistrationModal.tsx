import React, { useState } from 'react';
import { AlertCircle, Check, Gamepad2, LoaderCircle, Plus, Upload, X } from 'lucide-react';
import { Player, TeamAccount } from '../types/tournament';
import { createTeamAccount } from '../services/tournamentService';

interface Props {
  onSuccess: (account: TeamAccount) => void;
  onClose: () => void;
}

export const TeamAccountRegistrationModal: React.FC<Props> = ({ onSuccess, onClose }) => {
  const [teamName, setTeamName] = useState('');
  const [logo, setLogo] = useState('');
  const [logoName, setLogoName] = useState('');
  const [players, setPlayers] = useState<Player[]>([
    { name: '', role: 'main', slotIndex: 1 },
    { name: '', role: 'main', slotIndex: 2 },
    { name: '', role: 'main', slotIndex: 3 },
    { name: '', role: 'main', slotIndex: 4 },
    { name: '', role: 'backup', slotIndex: 5 },
  ]);
  const [showBackup, setShowBackup] = useState(false);
  const [acceptPaidTerms, setAcceptPaidTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogo = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Choose a PNG, JPG, or WebP image.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Logo must be 8 MB or smaller.'); return; }
    try {
      const source = await createImageBitmap(file);
      const scale = Math.min(1, 320 / Math.max(source.width, source.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image could not be processed.');
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      source.close();
      let quality = 0.86;
      let encoded = canvas.toDataURL('image/webp', quality);
      while (encoded.length > 300_000 && quality > 0.4) { quality -= 0.1; encoded = canvas.toDataURL('image/webp', quality); }
      if (encoded.length > 300_000) throw new Error('Logo is too detailed. Choose a smaller image.');
      setLogo(encoded);
      setLogoName(file.name);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process this image.');
    }
  };

  const updatePlayer = (index: number, name: string) => setPlayers((current) => current.map((player, i) => i === index ? { ...player, name } : player));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const submitted = showBackup && players[4].name.trim() ? players : players.slice(0, 4);
    if (!teamName.trim()) { setError('Enter your team name.'); return; }
    if (!logo) { setError('Upload your team logo.'); return; }
    if (!acceptPaidTerms) { setError('Please confirm the paid tournament wallet requirement.'); return; }
    if (submitted.some((player) => !player.name.trim())) { setError('Enter all four player IGNs.'); return; }
    if (new Set(submitted.map((player) => player.name.trim().toLocaleLowerCase())).size !== submitted.length) { setError('Each player must have a different IGN.'); return; }
    setLoading(true);
    try {
      const account = await createTeamAccount({ teamName: teamName.trim(), teamLogo: logo, leaderName: submitted[0].name.trim(), players: submitted });
      onSuccess(account);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send your team request. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="registration-backdrop fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#03050a]/80 p-3 backdrop-blur-xl sm:p-6">
      <section className="registration-card relative my-auto w-full max-w-xl overflow-hidden rounded-[28px] border border-white/[.1] bg-[#0e121c] text-white shadow-[0_40px_140px_rgba(0,0,0,.7)]">
        <header className="flex items-center justify-between border-b border-white/[.07] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3"><div className="brand-icon flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500"><Gamepad2 size={19} /></div><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-200">New Squad Account</div><h2 className="text-sm font-bold">Create your team profile</h2></div></div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/[.06] hover:text-white"><X size={17} /></button>
        </header>
        <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-7">
          <p className="text-xs leading-5 text-slate-400">Create your squad once, then sign in to browse and join tournaments.</p>
          <label className="block space-y-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Team name</span><input required maxLength={50} value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Enter your team name" className="registration-input w-full rounded-xl border border-white/10 bg-[#07080b] px-3.5 py-3 text-sm text-white outline-none focus:border-orange-300/50" /></label>
          <div className="space-y-2"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Player IGNs <span className="text-emerald-300">· 4 required</span></div><div className="grid gap-2">
            {players.slice(0, 4).map((player, index) => <label key={player.slotIndex} className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] p-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[.05] text-[10px] font-extrabold text-slate-300">{String(index + 1).padStart(2, '0')}</span><input required maxLength={40} value={player.name} onChange={(event) => updatePlayer(index, event.target.value)} placeholder={index === 0 ? 'Captain IGN' : `Player ${index + 1} IGN`} className="registration-input h-10 min-w-0 flex-1 rounded-lg border border-white/[.08] bg-[#07080b] px-3 text-sm text-white outline-none focus:border-orange-300/50" /></label>)}
          </div></div>
          {showBackup ? <label className="block space-y-1.5"><span className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-amber-200">Backup player · optional<button type="button" onClick={() => { setShowBackup(false); updatePlayer(4, ''); }} className="normal-case text-slate-500">Remove</button></span><input maxLength={40} value={players[4].name} onChange={(event) => updatePlayer(4, event.target.value)} placeholder="Backup IGN" className="registration-input w-full rounded-xl border border-amber-300/15 bg-[#07080b] px-3.5 py-3 text-sm text-white outline-none focus:border-amber-300/40" /></label> : <button type="button" onClick={() => setShowBackup(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-xs font-semibold text-slate-400 hover:border-amber-300/35 hover:text-amber-100"><Plus size={14} /> Add backup player</button>}
          <div className="space-y-2"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Team logo · required</div><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#07080b]">{logo ? <img src={logo} alt="Team logo preview" className="h-full w-full object-cover" /> : <Upload size={18} className="text-slate-500" />}</span><span className="min-w-0 flex-1"><input type="file" required={!logo} accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleLogo(event.target.files?.[0]); event.currentTarget.value = ''; }} className="block w-full cursor-pointer text-[10px] text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-orange-500/15 file:px-3 file:py-2 file:text-[10px] file:font-bold file:text-orange-100" /><span className="mt-1 block truncate text-[9px] text-slate-500">{logoName || 'PNG, JPG or WebP · max 8 MB'}</span></span></label></div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-300/15 bg-amber-300/[.04] px-3 py-2.5 text-[11px] leading-5 text-slate-300"><input type="checkbox" checked={acceptPaidTerms} onChange={(event) => setAcceptPaidTerms(event.target.checked)} className="mt-1 accent-orange-400" /><span>I understand paid tournament fees are deducted from my team wallet, and my balance must cover the entry fee.</span></label>
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[.07] px-3 py-2.5 text-xs text-rose-200"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>}
          <footer className="flex justify-end gap-2 border-t border-white/[.07] pt-4"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300">Cancel</button><button type="submit" disabled={loading || !acceptPaidTerms} className="action-primary inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">{loading ? <><LoaderCircle size={14} className="animate-spin" /> Creating</> : <><Check size={14} /> Create squad account</>}</button></footer>
        </form>
      </section>
    </div>
  );
};
