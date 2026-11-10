import React, { useState } from 'react';
import { AlertCircle, Check, Gamepad2, LoaderCircle, Plus, ShieldCheck, UserRoundPlus, X } from 'lucide-react';
import { Tournament, Team, Player } from '../types/tournament';
import { registerTeam, getLocalTeamProfile } from '../services/tournamentService';

interface Props {
  tournament: Tournament;
  onSuccess: (team: Team, tournament: Tournament) => void;
  onClose: () => void;
}

export const RegistrationModal: React.FC<Props> = ({ tournament, onSuccess, onClose }) => {
  const savedProfile = getLocalTeamProfile();
  const [teamName, setTeamName] = useState(savedProfile?.teamName || '');
  const [teamLogo, setTeamLogo] = useState(savedProfile?.teamLogo || '');
  const [logoImageReady, setLogoImageReady] = useState(Boolean(savedProfile?.teamLogo?.startsWith('data:image/')));
  const [logoName, setLogoName] = useState(savedProfile?.teamLogo ? 'Saved team logo' : '');
  const [players, setPlayers] = useState<Player[]>([
    { name: savedProfile?.leaderName || '', role: 'main', slotIndex: 1 },
    { name: '', role: 'main', slotIndex: 2 },
    { name: '', role: 'main', slotIndex: 3 },
    { name: '', role: 'main', slotIndex: 4 },
    { name: '', role: 'backup', slotIndex: 5 },
  ]);
  const [showBackup, setShowBackup] = useState(Boolean(savedProfile?.players?.some((player) => player.role === 'backup' && player.name.trim())));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUnavailable = tournament.status !== 'open' || tournament.registeredCount >= tournament.maxTeams;
  const updatePlayer = (index: number, name: string) => setPlayers((current) => current.map((player, i) => i === index ? { ...player, name } : player));

  const handleLogoUpload = async (file?: File) => {
    if (!file) return;
    setError(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Logo must be 8 MB or smaller.');
      return;
    }
    try {
      const source = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 320 / Math.max(source.width, source.height));
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image could not be processed.');
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      source.close();
      let quality = 0.86;
      let dataUrl = canvas.toDataURL('image/webp', quality);
      while (dataUrl.length > 300_000 && quality > 0.4) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/webp', quality);
      }
      if (dataUrl.length > 300_000) throw new Error('Logo is too detailed. Choose a smaller image.');
      setTeamLogo(dataUrl);
      setLogoImageReady(true);
      setLogoName(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process this image.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (isUnavailable) { setError('Registration is currently closed.'); return; }
    if (!teamName.trim()) { setError('Enter your team name.'); return; }
    if (!teamLogo.trim()) { setError('Add a logo link or upload your team logo.'); return; }
    if (!logoImageReady) { setError('Wait for the team logo preview to load.'); return; }
    const starters = players.slice(0, 4);
    const backup = players[4];
    const submittedPlayers = showBackup && backup.name.trim() ? [...starters, backup] : starters;
    const names = submittedPlayers.map((player) => player.name.trim().toLowerCase());
    if (starters.some((player) => !player.name.trim())) { setError('Enter all four player IGNs.'); return; }
    if (new Set(names).size !== names.length) { setError('Each player must have a different IGN.'); return; }

    setLoading(true);
    try {
      const { team } = await registerTeam({
        tournament,
        teamName: teamName.trim(),
        teamLogo,
        leaderName: starters[0].name.trim(),
        players: submittedPlayers,
      });
      onSuccess(team, tournament);
    } catch (cause) {
      console.error('Registration failed:', cause);
      setError(cause instanceof Error ? cause.message : 'Could not register. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registration-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#03050a]/80 p-3 backdrop-blur-xl sm:p-6">
      <section className="registration-card relative my-auto w-full max-w-xl overflow-hidden rounded-[28px] border border-white/[.1] bg-[#0e121c] text-white shadow-[0_40px_140px_rgba(0,0,0,.7)]">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-violet-600/15 blur-[95px]" />
        <div className="pointer-events-none absolute -bottom-36 -left-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-[95px]" />

        <header className="relative flex items-center justify-between border-b border-white/[.07] px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="brand-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-lg shadow-violet-950/40">
              <Gamepad2 size={21} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-200">Squad registration</div>
              <h2 className="mt-0.5 truncate text-sm font-bold text-white sm:text-base">{tournament.name}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close registration" className="ml-3 rounded-xl border border-white/[.07] bg-white/[.035] p-2 text-slate-400 transition hover:border-white/20 hover:bg-white/[.08] hover:text-white">
            <X size={17} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="relative space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="space-y-2">
            <label htmlFor="registration-team-name" className="block text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Team name</label>
            <input
              id="registration-team-name" autoComplete="organization" required maxLength={50} value={teamName}
              onChange={(event) => setTeamName(event.target.value)} placeholder="Enter your team name"
              disabled={isUnavailable}
              className="registration-input w-full rounded-2xl border border-white/[.09] bg-[#07080b]/90 px-4 py-3.5 text-sm font-semibold text-white outline-none transition placeholder:font-normal placeholder:text-slate-600 focus:border-indigo-400/60 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="registration-team-logo" className="block text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Team logo <span className="text-rose-300">· required</span></label>
            <div className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-2.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[.08] bg-[#07080b]">
                {teamLogo && logoImageReady ? <img src={teamLogo} alt="Team logo preview" className="h-full w-full object-cover" /> : <Gamepad2 size={19} className="text-slate-600" />}
              </div>
              {savedProfile?.teamLogo ? (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-emerald-200">Team logo saved</div>
                  <p className="mt-1 text-[9px] text-slate-500">Your logo will be reused for this registration.</p>
                </div>
              ) : <div className="min-w-0 flex-1 space-y-2">
                <input
                  id="registration-team-logo-link" type="url" maxLength={500} autoComplete="url" value={teamLogo.startsWith('data:') ? '' : teamLogo}
                  onChange={(event) => { setTeamLogo(event.target.value); setLogoImageReady(false); setLogoName(event.target.value ? 'Checking image link…' : ''); }}
                  placeholder="Paste logo image link"
                  disabled={isUnavailable}
                  className="registration-input block h-10 min-w-0 w-full rounded-xl border border-white/[.09] bg-[#07080b]/90 px-3.5 text-xs font-medium text-white outline-none transition placeholder:font-normal placeholder:text-slate-600 focus:border-indigo-400/60 disabled:opacity-50"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">or</span>
                  <input
                  id="registration-team-logo" type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => { void handleLogoUpload(event.target.files?.[0]); event.currentTarget.value = ''; }}
                  disabled={isUnavailable}
                  className="registration-input block h-9 min-w-0 flex-1 cursor-pointer rounded-xl border border-white/[.09] bg-[#07080b]/90 px-2.5 py-1.5 text-[10px] font-medium text-white outline-none transition file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-500/20 file:px-2.5 file:py-1 file:text-[9px] file:font-bold file:text-indigo-200 disabled:opacity-50"
                />
                </div>
                <p className="truncate pl-1 text-[9px] text-slate-600">{logoName || 'PNG, JPG or WebP · max 8 MB'}</p>
              </div>}
              {teamLogo && <img src={teamLogo} alt="" aria-hidden="true" className="hidden" onLoad={() => setLogoImageReady(true)} onError={() => setLogoImageReady(false)} />}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Player IGNs</label>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300"><ShieldCheck size={13} /> 4 required</span>
            </div>
            <div className="grid gap-2.5">
              {players.slice(0, 4).map((player, index) => (
                <label key={player.slotIndex} className="registration-player-row block rounded-2xl border border-white/[.07] bg-white/[.025] p-3 transition-colors focus-within:border-indigo-300/35 focus-within:bg-indigo-300/[.035]" style={{ animationDelay: `${index * 55}ms` }}>
                  <span className="mb-2 flex items-center gap-2.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold ${index === 0 ? 'border border-indigo-300/20 bg-indigo-400/10 text-indigo-200' : 'border border-white/[.06] bg-white/[.04] text-slate-400'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-[.13em] text-slate-500">{index === 0 ? 'Captain · required' : `Player ${index + 1} · required`}</span>
                  </span>
                  <input
                    type="text" required maxLength={40} autoComplete="off" value={player.name}
                    onChange={(event) => updatePlayer(index, event.target.value)} placeholder="In-game name (IGN)"
                    disabled={isUnavailable}
                    className="registration-input block h-12 min-w-0 w-full rounded-xl border border-white/[.09] bg-[#07080b]/90 px-3.5 text-sm font-medium text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 disabled:opacity-50"
                  />
                </label>
              ))}
            </div>
          </div>

          {showBackup ? (
            <div className="registration-player-row rounded-2xl border border-amber-300/15 bg-amber-300/[.035] p-3">
              <span className="mb-2 flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-300/15 bg-amber-300/[.08] text-[10px] font-extrabold text-amber-200">05</span>
                <span className="flex flex-1 items-center justify-between text-[9px] font-bold uppercase tracking-[.13em] text-amber-200/60">Backup · optional
                  <button type="button" onClick={() => { updatePlayer(4, ''); setShowBackup(false); }} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-white/[.06] hover:text-white">Remove</button>
                </span>
              </span>
              <input aria-label="Backup player IGN" type="text" maxLength={40} autoComplete="off" value={players[4].name} onChange={(event) => updatePlayer(4, event.target.value)} placeholder="Backup player IGN" disabled={isUnavailable} className="registration-input block h-12 min-w-0 w-full rounded-xl border border-amber-300/10 bg-[#07080b]/90 px-3.5 text-sm font-medium text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/40 disabled:opacity-50" />
            </div>
          ) : (
            <button type="button" disabled={isUnavailable} onClick={() => setShowBackup(true)} className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[.13] bg-white/[.015] py-3 text-xs font-semibold text-slate-400 transition hover:border-amber-300/30 hover:bg-amber-300/[.035] hover:text-amber-100 disabled:opacity-40">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[.06] transition group-hover:bg-amber-300/10"><Plus size={13} /></span>
              Add backup player <span className="text-[10px] font-normal text-slate-600">(optional)</span>
            </button>
          )}

          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[.07] px-3.5 py-3 text-xs leading-5 text-rose-200"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
          {isUnavailable && <div className="text-center text-xs font-semibold text-amber-200">Registration is closed.</div>}

          <footer className="flex flex-col-reverse gap-2.5 border-t border-white/[.07] pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-white/[.08] bg-white/[.035] px-5 py-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[.08] hover:text-white">Cancel</button>
            <button type="submit" disabled={loading || isUnavailable} className="action-primary flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ember-600 to-amber-500 px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-violet-950/40 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <><LoaderCircle size={15} className="animate-spin" /> Registering</> : <><Check size={15} /> Register squad</>}
            </button>
          </footer>
          <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-600"><UserRoundPlus size={11} /> Squad details only</div>
        </form>
      </section>
    </div>
  );
};
