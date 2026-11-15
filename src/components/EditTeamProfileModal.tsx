import React, { useState } from 'react';
import { Check, LoaderCircle, Upload, X } from 'lucide-react';
import { Player, TeamProfile } from '../types/tournament';
import { saveTeamAccountEdits } from '../services/tournamentService';

interface Props {
  profile: TeamProfile;
  onClose: () => void;
  onSaved: (profile: TeamProfile) => void;
}

export const EditTeamProfileModal: React.FC<Props> = ({ profile, onClose, onSaved }) => {
  const [logo, setLogo] = useState(profile.teamLogo || '');
  const [logoName, setLogoName] = useState('');
  const [players, setPlayers] = useState<Player[]>(Array.from({ length: 5 }, (_, index) => profile.players.find((player) => player.slotIndex === index + 1) || { name: '', role: index === 4 ? 'backup' : 'main', slotIndex: index + 1 }));
  const [showBackup, setShowBackup] = useState(Boolean(profile.players.some((player) => player.role === 'backup' && player.name.trim())));
  const [saving, setSaving] = useState(false);
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not process this image.'); }
  };

  const setPlayerName = (index: number, name: string) => setPlayers((current) => current.map((player, itemIndex) => itemIndex === index ? { ...player, name } : player));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const updatedPlayers = showBackup && players[4].name.trim() ? players : players.slice(0, 4);
    if (updatedPlayers.slice(0, 4).some((player) => !player.name.trim())) { setError('Enter all four main player IGNs.'); return; }
    if (!logo) { setError('Upload a team logo.'); return; }
    setSaving(true);
    try {
      const updated = await saveTeamAccountEdits(profile.userId, profile.teamName, profile.whatsappNumber || '', logo, updatedPlayers);
      onSaved({ ...profile, ...updated, updatedAt: new Date().toISOString() });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save team profile.'); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
    <section className="wallet-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-cyan-300/15 bg-[#11141d] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[.07] bg-[#11141d]/95 px-5 py-4 backdrop-blur"><div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-200">Squad profile</div><h2 className="mt-1 text-base font-extrabold">Edit team logo & players</h2><p className="mt-1 text-[10px] text-slate-400">Changes apply to your team account; captain is updated from Player 1.</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-white/[.06] hover:text-white"><X size={17}/></button></header>
      <form onSubmit={(event) => void submit(event)} className="space-y-4 p-5">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#07080b]">{logo ? <img src={logo} alt="Team logo preview" className="h-full w-full object-cover"/> : <Upload size={18} className="text-slate-500"/>}</span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-300">Team logo</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void handleLogo(event.target.files?.[0]); event.currentTarget.value = ''; }} className="mt-1 block w-full cursor-pointer text-[10px] text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:text-[10px] file:font-bold file:text-cyan-100"/><span className="mt-1 block truncate text-[9px] text-slate-500">{logoName || 'PNG, JPG or WebP · max 8 MB'}</span></span></label>
        <div className="grid gap-2 sm:grid-cols-2">{players.slice(0, 4).map((player, index) => <label key={player.slotIndex} className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Player {index + 1}{index === 0 ? ' · Captain' : ''}</span><input required maxLength={40} value={player.name} onChange={(event) => setPlayerName(index, event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#090b10] px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-300/30"/></label>)}</div>
        {showBackup ? <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-amber-200">Backup player · optional</span><input maxLength={40} value={players[4].name} onChange={(event) => setPlayerName(4, event.target.value)} placeholder="Backup IGN" className="w-full rounded-xl border border-amber-300/15 bg-[#090b10] px-3 py-2.5 text-xs text-white outline-none focus:border-amber-300/35"/></label> : <button type="button" onClick={() => setShowBackup(true)} className="w-full rounded-xl border border-dashed border-white/15 py-2.5 text-xs font-semibold text-slate-400 hover:border-amber-300/35 hover:text-amber-100">+ Add backup player</button>}
        <p className="rounded-xl border border-white/[.06] bg-white/[.025] p-3 text-[10px] leading-5 text-slate-400">Save requires the WhatsApp number already linked to this team account. No verification message will be sent.</p>
        {error && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] px-3 py-2 text-[11px] text-rose-200">{error}</div>}
        <footer className="flex justify-end gap-2 border-t border-white/[.07] pt-4"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">{saving ? <><LoaderCircle size={14} className="animate-spin"/>Saving</> : <><Check size={14}/>Save profile</>}</button></footer>
      </form>
    </section>
  </div>;
};
