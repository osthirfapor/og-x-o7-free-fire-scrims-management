import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Gamepad2, KeyRound, ShieldCheck } from 'lucide-react';
import { TeamProfile } from '../types/tournament';
import { findRegisteredTeamProfile, getLocalTeamProfile, saveTeamProfile } from '../services/tournamentService';

interface Props {
  onLoginSuccess: (profile: TeamProfile) => void;
  onOpenAdminSecret?: () => void;
  onRegister?: () => void;
}

export const TeamLoginGate: React.FC<Props> = ({ onLoginSuccess, onOpenAdminSecret, onRegister }) => {
  const existing = getLocalTeamProfile();
  const [teamName, setTeamName] = useState(existing?.teamName || '');
  const [leaderName, setLeaderName] = useState(existing?.leaderName || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);

  const handleLogoTap = () => {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (next >= 4) {
      setLogoTaps(0);
      onOpenAdminSecret?.();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const profile = await findRegisteredTeamProfile(teamName, leaderName);
      if (!profile) {
        setError('Team not found. Check your details or register first.');
        return;
      }
      await saveTeamProfile(profile);
      onLoginSuccess(profile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="login-stage app-shell flex min-h-screen items-center justify-center px-4 py-8 text-white sm:px-6">
      <section className="login-panel relative z-10 w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#10141f]/90 shadow-[0_30px_120px_rgba(0,0,0,.55)] backdrop-blur-2xl lg:grid lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative hidden min-h-[570px] overflow-hidden border-r border-white/10 bg-[#101521] p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="login-grid absolute inset-0 opacity-40" />
          <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-[100px]" />
          <div className="absolute -bottom-16 right-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-[100px]" />
          <div className="relative z-10 flex items-center gap-3">
            <button type="button" onClick={handleLogoTap} className="brand-icon flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-300/20 bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Gamepad2 size={24} />
            </button>
            <div>
              <div className="brand-wordmark text-lg font-black tracking-wide">OG x o7</div>
              <div className="text-[10px] font-bold uppercase tracking-[.24em] text-indigo-300">Free Fire Scrims</div>
            </div>
          </div>
          <div className="relative z-10 max-w-md">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-indigo-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /> Squad access
            </div>
            <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white xl:text-5xl">
              Your next <span className="text-gradient">Booyah</span> starts here.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
              Sign in with your approved squad details to explore tournaments, standings, and player stats.
            </p>
          </div>
          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-slate-500">
            <span>OG x o7 competitive hub</span>
            <span className="font-mono tracking-widest">EST. 2026</span>
          </div>
        </div>

        <div className="relative z-10 flex min-h-[570px] flex-col justify-center p-6 sm:p-10 lg:p-12">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <button type="button" onClick={handleLogoTap} className="brand-icon flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-300/20 bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
              <Gamepad2 size={22} />
            </button>
            <div>
              <div className="brand-wordmark text-base font-black tracking-wide">OG x o7</div>
              <div className="text-[9px] font-bold uppercase tracking-[.2em] text-indigo-300">Free Fire Scrims</div>
            </div>
          </div>

          <div className="mb-7">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
              <KeyRound size={20} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">Registered squads only</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Welcome back, Captain</h2>
            <p className="mt-2 text-xs leading-5 text-slate-400">Enter your registered team details.</p>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">Registered team name</span>
              <input
                type="text"
                required
                maxLength={50}
                autoComplete="organization"
                placeholder="Enter your team name"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0b0f18] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-300">Captain in-game name (IGN)</span>
              <input
                type="text"
                required
                maxLength={40}
                autoComplete="username"
                placeholder="Enter the registered leader IGN"
                value={leaderName}
                onChange={(event) => setLeaderName(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0b0f18] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
              />
            </label>

            <button
              type="submit"
              disabled={saving || !teamName.trim() || !leaderName.trim()}
              className="action-primary mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-900/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? <span className="loading-dots">Checking squad</span> : <>Enter the scrims hub <ArrowRight size={16} /></>}
            </button>
          </form>

          {onRegister && (
            <button type="button" onClick={onRegister} className="mt-3 w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs font-bold text-slate-200 transition hover:border-indigo-300/30 hover:bg-indigo-400/10">
              Register a squad
            </button>
          )}

          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-slate-600">
            <ShieldCheck size={13} className="text-emerald-300" /> Secure squad access
          </div>
        </div>
      </section>
    </main>
  );
};
