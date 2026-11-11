/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Flame,
  Users,
  Search,
  Shield,
  Clock,
  Gamepad2,
  LayoutGrid,
  Menu,
  X,
  Trophy,
  Zap,
  DollarSign,
  ArrowRight,
  CheckCircle,
  MapPin,
  Calendar,
  Sparkles,
  LogOut,
  Wallet,
  X as CloseIcon,
  ChevronDown,
  CalendarDays,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Tournament, Team, TeamAccount, TournamentCategory, TeamProfile, MatchResult } from './types/tournament';
import {
  subscribeTournaments,
  subscribeTeams,
  subscribeMatchResults,
  buildLeaderboard,
  getLocalTeamProfile,
  findRegisteredTeamProfile,
  saveTeamProfile,
  subscribeTeamWallet,
  subscribeTeamAccounts,
} from './services/tournamentService';
import { LeaderboardView } from './components/LeaderboardView';
import { testConnection } from './lib/firebase';
import { sendDiscordEvent } from './lib/discordEvents';
import { RegistrationModal } from './components/RegistrationModal';
import { RegistrationSuccessModal } from './components/RegistrationSuccessModal';
import { TeamLoginGate } from './components/TeamLoginGate';
import { TeamAccountRegistrationModal } from './components/TeamAccountRegistrationModal';
import { PlayerSearchView } from './components/PlayerSearchView';
import { RegisteredTeamsView } from './components/RegisteredTeamsView';
import { AdminPanelModal } from './components/AdminPanelModal';

const PUBLIC_READ_ONLY = import.meta.env.VITE_READ_ONLY_MODE === 'true';
// The admin route is public to reach, but Firebase Auth + the protected admin
// allowlist determine whether anyone can see or change admin data.
const ADMIN_PANEL_ENABLED = true;

// Free Fire Themed PNG Art / Illustrations for Square Cards
const CARD_BACKGROUNDS: Record<string, string> = {
  practice: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
  free: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&auto=format&fit=crop&q=80',
  paid: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80',
};

function MainApp() {
  const { isAdmin } = useAuth();

  // Navigation Views: 'tournaments' | 'leaderboard' | 'player_search' (+ 'registered_teams' opened from a tournament card)
  const [activeTab, setActiveTab] = useState<'tournaments' | 'my_tournaments' | 'leaderboard' | 'registered_teams' | 'player_search'>('tournaments');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TournamentCategory>('all');
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Secret Admin access via taps or long-press on mobile
  const [logoTapCount, setLogoTapCount] = useState(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Tournaments & Teams State from Firestore
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [teamAccounts, setTeamAccounts] = useState<TeamAccount[]>([]);
  const [teamAccountsLoaded, setTeamAccountsLoaded] = useState(false);
  const currentTeams = useMemo(
    () => allTeams.filter((team) => team.tournamentId === activeTournament?.id),
    [allTeams, activeTournament?.id]
  );
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  // Captain / Team Profile State (for 1-click Auto-Refill)
  const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(() => getLocalTeamProfile());
  const [checkingTeamSession, setCheckingTeamSession] = useState(() => Boolean(getLocalTeamProfile()));
  const [walletBalance, setWalletBalance] = useState(0);
  const [topUpSelection, setTopUpSelection] = useState('500');
  const [customTopUpAmount, setCustomTopUpAmount] = useState('');

  // Modals
  const [showRegModal, setShowRegModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTeamAccountRegistration, setShowTeamAccountRegistration] = useState(false);
  const [newAccountCredentials, setNewAccountCredentials] = useState<{ teamName: string; leaderName: string } | null>(null);
  const [registeredSuccessTeam, setRegisteredSuccessTeam] = useState<Team | null>(null);
  const [isAdminPage, setIsAdminPage] = useState(() => ADMIN_PANEL_ENABLED && new URLSearchParams(window.location.search).get('panel') === 'admin');
  const handledRegistrationLink = useRef(false);

  const openAdminPage = () => {
    if (!ADMIN_PANEL_ENABLED) return;
    const adminUrl = new URL(window.location.href);
    adminUrl.searchParams.set('panel', 'admin');
    window.open(adminUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  const leaveAdminPage = () => {
    const publicUrl = new URL(window.location.href);
    publicUrl.searchParams.delete('panel');
    window.location.assign(publicUrl.toString());
  };

  const handleLogoutTeam = () => {
    localStorage.removeItem('ogxo7_captain_team_profile');
    setTeamProfile(null);
  };

  useEffect(() => {
    if (!teamProfile) {
      setCheckingTeamSession(false);
      return;
    }
    let cancelled = false;
    findRegisteredTeamProfile(teamProfile.teamName, teamProfile.leaderName)
      .then(async (verifiedProfile) => {
        if (cancelled) return;
        if (!verifiedProfile || verifiedProfile.registrationId !== teamProfile.registrationId) {
          localStorage.removeItem('ogxo7_captain_team_profile');
          setTeamProfile(null);
          return;
        }
        await saveTeamProfile(verifiedProfile);
        if (!cancelled) setTeamProfile(verifiedProfile);
      })
      .catch((error) => {
        // A temporary Firestore/network failure must not erase a valid saved
        // browser session; keep the current profile and retry on a later load.
        console.warn('Could not verify the saved squad session; keeping the local session:', error);
      })
      .finally(() => {
        if (!cancelled) setCheckingTeamSession(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Registration links select the right tournament and open its form directly.
  // A saved squad can still use this link; the form will prefill its local profile.
  useEffect(() => {
    if (handledRegistrationLink.current || isAdminPage || PUBLIC_READ_ONLY || !tournaments.length || checkingTeamSession) return;
    const requestedId = new URLSearchParams(window.location.search).get('register');
    if (!requestedId) return;
    const requestedTournament = tournaments.find((tournament) => tournament.id === requestedId);
    if (!requestedTournament) return;
    handledRegistrationLink.current = true;
    setActiveTournament(requestedTournament);
    // A direct link should land new visitors at login. A logged-in squad can
    // continue straight into tournament registration.
    setShowRegModal(Boolean(teamProfile) && requestedTournament.status === 'open' && requestedTournament.registeredCount < requestedTournament.maxTeams);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('register');
    window.history.replaceState({}, '', cleanUrl.toString());
  }, [tournaments, isAdminPage, checkingTeamSession, teamProfile, walletBalance]);

  const handleOpenRegistration = (tour?: Tournament) => {
    const target = tour || activeTournament;
    if (!target || target.status !== 'open' || target.registeredCount >= target.maxTeams) return;
    if (myRegistrations.some((registration) => registration.tournament.id === target.id)) return;
    const fee = target.category === 'paid' ? Number(target.entryFeeAmount ?? target.entryFee ?? 0) : 0;
    if (fee > walletBalance) {
      alert(`You don't have enough money to join this paid tournament. Entry fee: ৳${fee}; your wallet: ৳${walletBalance}. Open Wallet → Add Money to request a top-up.`);
      return;
    }
    if (tour) setActiveTournament(tour);
    setShowRegModal(true);
  };

  // Keep legacy secret URLs working by routing them to the dedicated admin page.
  useEffect(() => {
    const search = window.location.search;
    if (ADMIN_PANEL_ENABLED && (search.includes('adminnn') || search.includes('admin=true') || window.location.hash.includes('adminnn'))) {
      const adminUrl = new URL(window.location.href);
      adminUrl.searchParams.set('panel', 'admin');
      window.history.replaceState({}, '', adminUrl.toString());
      setIsAdminPage(true);
    }

    // Secret shortcut: Ctrl + Shift + A to open admin on desktop
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        openAdminPage();
      }
    };
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  // Test connection & seed initial data on load
  useEffect(() => {
    testConnection().catch(console.error);
  }, []);

  // Subscribe to tournaments
  useEffect(() => {
    const unsub = subscribeTournaments((data) => {
      setTournaments(data);
      setLoadingTournaments(false);
      if (data.length > 0) {
        setActiveTournament((prev) => {
          if (!prev) return data[0];
          const found = data.find((t) => t.id === prev.id);
          return found || data[0];
        });
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to match results (for Leaderboard)
  useEffect(() => {
    const unsub = subscribeMatchResults((data) => setMatchResults(data));
    return () => unsub();
  }, []);

  useEffect(() => subscribeTeamAccounts((accounts) => {
    setTeamAccounts(accounts);
    setTeamAccountsLoaded(true);
  }, () => setTeamAccountsLoaded(true)), []);

  useEffect(() => {
    if (!teamAccountsLoaded || !teamProfile || !teamProfile.userId.startsWith('account_')) return;
    const accountStillExists = teamAccounts.some((account) => account.id === teamProfile.userId);
    if (!accountStillExists) handleLogoutTeam();
  }, [teamAccounts, teamAccountsLoaded, teamProfile?.userId]);

  useEffect(() => {
    if (!teamProfile) {
      setWalletBalance(0);
      return;
    }
    return subscribeTeamWallet(teamProfile.teamName, (wallet) => setWalletBalance(Number(wallet?.balance) || 0));
  }, [teamProfile?.teamName]);

  // Subscribe to every tournament so search and player totals use full history.
  const tournamentIds = tournaments.map((tournament) => tournament.id).sort().join('|');
  useEffect(() => {
    const ids = tournamentIds ? tournamentIds.split('|') : [];
    if (ids.length === 0) {
      setAllTeams([]);
      return;
    }
    const unsubscribers = ids.map((tournamentId) => subscribeTeams(tournamentId, (teams) => {
      setAllTeams((previous) => [
        ...previous.filter((team) => team.tournamentId !== tournamentId),
        ...teams,
      ]);
    }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [tournamentIds]);

  // Filter tournaments by category
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      const hasAvailableSlots = t.registeredCount < t.maxTeams;
      return t.status !== 'completed' && hasAvailableSlots && (categoryFilter === 'all' || (t.category || 'practice') === categoryFilter);
    });
  }, [tournaments, categoryFilter]);

  // Real leaderboard built from admin-entered match results
  const publishedResults = useMemo(() => matchResults.filter((result) => result.published !== false), [matchResults]);
  const leaderboard = useMemo(() => buildLeaderboard(publishedResults), [publishedResults]);
  const walletEntries = useMemo(() => publishedResults
    .filter((result) => result.teamName.trim().toLocaleLowerCase() === teamProfile?.teamName.trim().toLocaleLowerCase() && Number(result.earnings) > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [publishedResults, teamProfile?.teamName]);
  const walletTotal = walletEntries.reduce((sum, result) => sum + (Number(result.earnings) || 0), 0);
  const requestedTopUpAmount = topUpSelection === 'custom' ? Number(customTopUpAmount) : Number(topUpSelection);
  const handleTopUpWhatsApp = () => {
    if (!Number.isFinite(requestedTopUpAmount) || requestedTopUpAmount <= 0 || !teamProfile) return;
    void sendDiscordEvent('wallet_topup_requested', {
      'Team name': teamProfile.teamName,
      'Captain IGN': teamProfile.leaderName,
      'Requested amount': `৳${requestedTopUpAmount.toLocaleString()}`,
      'Current wallet': `৳${walletBalance.toLocaleString()}`,
    });
    const message = [
      'Hi, I need add money to my team wallet.',
      `Team name: ${teamProfile.teamName}`,
      `Captain IGN: ${teamProfile.leaderName}`,
      `Amount: BDT ${requestedTopUpAmount.toLocaleString()}`,
      `Current wallet balance: BDT ${walletBalance.toLocaleString()}`,
    ].join('\n');
    window.open(`https://wa.me/8801937679130?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };
  const myRegistrations = useMemo(() => {
    if (!teamProfile) return [];
    return allTeams
      .filter((team) => team.teamName.trim().toLocaleLowerCase() === teamProfile.teamName.trim().toLocaleLowerCase()
        && team.leaderName.trim().toLocaleLowerCase() === teamProfile.leaderName.trim().toLocaleLowerCase())
      .map((team) => ({ team, tournament: tournaments.find((tournament) => tournament.id === team.tournamentId) }))
      .filter((item): item is { team: Team; tournament: Tournament } => Boolean(item.tournament))
      .sort((a, b) => new Date(b.team.createdAt).getTime() - new Date(a.team.createdAt).getTime());
  }, [allTeams, teamProfile?.teamName, teamProfile?.leaderName, tournaments]);
  const myStanding = useMemo(() => {
    if (!teamProfile) return null;
    const idx = leaderboard.findIndex(
      (e) => e.teamName.trim().toLowerCase() === teamProfile.teamName.trim().toLowerCase()
    );
    return idx === -1 ? null : { rank: idx + 1, ...leaderboard[idx] };
  }, [leaderboard, teamProfile]);

  const handleRegisterSuccess = (team: Team, tournament: Tournament) => {
    setShowRegModal(false);
    setRegisteredSuccessTeam(team);
    setShowSuccessModal(true);
  };

  // Mobile secret triggers: Tap logo 4 times to open Admin
  const handleLogoTap = () => {
    const next = logoTapCount + 1;
    setLogoTapCount(next);
    if (next >= 4) {
      setLogoTapCount(0);
      openAdminPage();
    }
  };

  // Mobile secret trigger: Long-press (1.5 seconds) on the title
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      openAdminPage();
    }, 1400);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  if (isAdminPage && ADMIN_PANEL_ENABLED) {
    const adminTournament = activeTournament || tournaments[0] || {
      id: '', name: 'No tournament selected', game: 'Garena Free Fire', category: 'practice' as const,
      date: '', time: '', maxTeams: 12, registeredCount: 0, status: 'closed' as const,
      redirectLink: '', redirectLinkEnabled: false, redirectButtonText: 'Join Official Discord Lounge', createdAt: new Date().toISOString(),
    };

    return (
      <AdminPanelModal
        standalone
        tournaments={tournaments}
        teams={currentTeams}
        activeTournament={adminTournament}
        onSelectTournament={(t) => setActiveTournament(t)}
        onClose={leaveAdminPage}
      />
    );
  }

  // ================= MANDATORY LOGIN GATE =================
  // Without login, show only the team login form and any explicitly requested registration form.
  if (checkingTeamSession) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center p-6 text-white">
        <div className="login-panel flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111218]/90 px-5 py-4 text-sm text-slate-300 shadow-2xl">
          <span className="h-2 w-2 animate-ping rounded-full bg-cyan-300" /> Opening your squad profile…
        </div>
      </main>
    );
  }

  if (!teamProfile) {
    return (
      <>
        <TeamLoginGate
          prefill={newAccountCredentials}
          onLoginSuccess={(profile) => {
            setShowSuccessModal(false);
            setRegisteredSuccessTeam(null);
            setNewAccountCredentials(null);
            setTeamProfile(profile);
          }}
          onOpenAdminSecret={openAdminPage}
          onRegister={() => setShowTeamAccountRegistration(true)}
        />
        {showTeamAccountRegistration && (
          <TeamAccountRegistrationModal
            onClose={() => setShowTeamAccountRegistration(false)}
            onSuccess={(account) => {
              setShowTeamAccountRegistration(false);
              setNewAccountCredentials({ teamName: account.teamName, leaderName: account.leaderName });
            }}
          />
        )}
        {!PUBLIC_READ_ONLY && showRegModal && activeTournament && (
          <RegistrationModal
            tournament={activeTournament}
            onSuccess={(team, tournament) => {
              const profile: TeamProfile = {
                userId: `${team.tournamentId}_${team.id}`,
                registrationId: team.registrationId,
                teamName: team.teamName,
                teamLogo: team.teamLogo || '',
                leaderName: team.leaderName,
                players: team.players,
                updatedAt: new Date().toISOString(),
              };
              void saveTeamProfile(profile);
              setTeamProfile(profile);
              setRegisteredSuccessTeam(team);
              setActiveTournament(tournament);
              setShowRegModal(false);
              setShowSuccessModal(true);
            }}
            onClose={() => setShowRegModal(false)}
          />
        )}
        {showSuccessModal && registeredSuccessTeam && activeTournament && (
          <RegistrationSuccessModal
            team={registeredSuccessTeam}
            tournament={activeTournament}
            onClose={() => setShowSuccessModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="app-shell relative isolate min-h-screen text-white font-sans flex flex-col md:flex-row antialiased select-none">
      {/* ================= CLEAN DESKTOP LEFT SIDEBAR ================= */}
      <aside
        className={`sidebar-shell fixed inset-y-0 left-0 z-40 w-64 border-r flex flex-col justify-between py-6 px-4 transform transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <div className="flex items-center justify-between px-2">
            <div
              onClick={handleLogoTap}
              className="flex items-center gap-3 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="brand-icon w-9 h-9 rounded-xl bg-gradient-to-tr from-ember-500 via-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Gamepad2 size={18} className="text-white" />
              </div>
              <div>
                <span className="brand-wordmark block font-extrabold text-base tracking-wider">OG x o7</span>
                <span className="block text-[9px] text-indigo-300 font-bold uppercase tracking-[.2em]">
                  Free Fire Scrims
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-gray-400 hover:text-white p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Clean Navigation Items */}
          <div className="space-y-1.5">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Menu</div>
            {[
              { key: 'tournaments', label: 'Tournaments', icon: <Flame size={17} />, tint: 'text-indigo-400' },
              { key: 'my_tournaments', label: 'My Tournaments', icon: <CalendarDays size={17} />, tint: 'text-cyan-300' },
              { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={17} />, tint: 'text-amber-400' },
              { key: 'player_search', label: 'All Teams', icon: <Search size={17} />, tint: 'text-emerald-400' },
            ].map((item) => {
              const active = activeTab === item.key || (item.key === 'tournaments' && activeTab === 'registered_teams');
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveTab(item.key as any);
                    if (item.key === 'tournaments') setCategoryFilter('all');
                    setMobileMenuOpen(false);
                  }}
                  className={`sidebar-link relative w-full flex items-center gap-3 px-3.5 py-3 text-[13px] font-bold rounded-xl transition-all ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/10 text-white border border-indigo-500/30 shadow-lg shadow-indigo-900/20'
                      : 'text-gray-400 hover:text-white hover:bg-[#17181f] border border-transparent'
                  }`}
                >
                  {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r bg-indigo-400" />}
                  <span className={active ? item.tint : ''}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secret Desktop Footer */}
        <div
          onClick={handleLogoTap}
          className="brand-wordmark px-3 py-2 text-[11px] text-gray-500 cursor-default"
        >
          OG x o7 Free Fire Esports
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ================= MAIN CONTENT WRAPPER ================= */}
      <div className="relative z-[1] flex-1 md:ml-64 flex flex-col min-w-0">
        {/* TOP BAR / HEADER */}
        <header className="topbar-shell h-[72px] border-b px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#1c1d26]"
            >
              <Menu size={20} />
            </button>

            {/* Header Brand for Mobile (Supports secret long press for Admin) */}
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={handleLogoTap}
              className="md:hidden flex items-center gap-2"
            >
              <div className="brand-icon w-8 h-8 rounded-xl bg-gradient-to-tr from-ember-500 via-amber-400 to-yellow-300 flex items-center justify-center">
                <Gamepad2 size={16} className="text-white" />
              </div>
              <span className="brand-wordmark font-extrabold text-sm tracking-wide">OG x o7</span>
            </div>
            <div className="hidden md:block">
              <div className="text-[9px] font-extrabold uppercase tracking-[.22em] text-slate-500">Squad command center</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300"><Sparkles size={12} className="text-cyan-300" /> Live scrim operations</div>
            </div>
          </div>

          {/* Profile menu */}
          <div className="relative flex shrink-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowWallet(true)} className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-amber-300/20 bg-amber-300/[.07] px-3 py-2 text-xs font-extrabold tabular-nums text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-300/[.12]" title="Open team wallet">৳{walletBalance.toLocaleString()}</button>
            <button type="button" aria-haspopup="menu" aria-expanded={showProfileMenu} onClick={() => setShowProfileMenu((open) => !open)} className="profile-trigger flex min-h-12 max-w-[min(58vw,280px)] shrink items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] p-1.5 pr-2.5 text-xs transition hover:border-indigo-300/25 hover:bg-white/[.06]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-indigo-300/25 bg-indigo-500/15">{teamProfile.teamLogo ? <img src={teamProfile.teamLogo} alt={`${teamProfile.teamName} logo`} className="h-full w-full object-cover" /> : <Gamepad2 size={15} className="text-indigo-200" />}</span>
              <span className="min-w-0 text-left"><span className="block truncate font-bold text-slate-100">{teamProfile.teamName}</span><span className="block text-[10px] text-slate-500">Profile</span></span>
              <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>
            {showProfileMenu && <>
              <button type="button" aria-label="Close profile menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setShowProfileMenu(false)} />
              <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#141720] p-2 shadow-2xl shadow-black/50 animate-fade-in">
                <div className="border-b border-white/[.07] px-3 py-2.5"><div className="truncate text-xs font-extrabold text-white">{teamProfile.teamName}</div><div className="mt-1 truncate text-[10px] text-slate-500">Captain · {teamProfile.leaderName}</div></div>
                <button role="menuitem" type="button" onClick={() => { setShowProfileMenu(false); setShowWallet(true); }} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-amber-100 transition hover:bg-amber-300/[.08]">Wallet balance <span className="ml-auto text-[10px] text-amber-200/70">৳{walletBalance.toLocaleString()}</span></button>
                <button role="menuitem" type="button" onClick={() => { setShowProfileMenu(false); handleLogoutTeam(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-rose-200 transition hover:bg-rose-300/[.08]"><LogOut size={15} /> Log out</button>
              </div>
            </>}
          </div>
        </header>

        {/* ================= BODY CONTENT AREA ================= */}
        <div key={activeTab} className="app-main-content flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="page-intro mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-indigo-300">
                <span className="h-px w-6 bg-gradient-to-r from-cyan-300 to-indigo-400" /> OG x o7 competitive hub
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {activeTab === 'tournaments' || activeTab === 'registered_teams'
                  ? 'Tournament arena'
                  : activeTab === 'my_tournaments' ? 'My Tournaments' : activeTab === 'leaderboard' ? 'Hall of champions' : 'Squad roster'}
              </h1>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                {activeTab === 'tournaments' || activeTab === 'registered_teams'
                  ? 'Find your next Free Fire scrim and secure your squad’s place.'
                  : activeTab === 'my_tournaments' ? 'Your squad’s registrations. Select a tournament to view its registered teams.' : activeTab === 'leaderboard' ? 'Every match. Every Booyah. One standings board.' : 'Open any squad to see its players and how many matches each has played.'}
              </p>
            </div>
            <div className="live-indicator inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[.06] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" /></span>
              {loadingTournaments ? 'Connecting to Firebase' : `${tournaments.length} tournaments live`}
            </div>
          </div>
          {/* TAB 1: ALL TOURNAMENTS WITH SQUARE SHAPE CARDS (Matches Image Reference) */}
          {activeTab === 'tournaments' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left / Center 8 Columns */}
              <div className="lg:col-span-8 space-y-6">
                {/* ================= SQUARE SHAPE TOURNAMENT CARDS SECTION ================= */}
                {/* Formatted in square shape with background graphic and name at bottom, matching image_a54476d2.png */}
                <div className="space-y-4">
                  {/* Category Pills Header */}
                  <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
                    <div className="flex items-center gap-2">
                      <LayoutGrid size={18} className="text-purple-400" />
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        All Tournaments
                      </h3>
                    </div>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-1 bg-[#0f1015] p-1 rounded-xl border border-[#23242e] text-xs shrink-0">
                      <button
                        onClick={() => setCategoryFilter('all')}
                        className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                          categoryFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setCategoryFilter('practice')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                          categoryFilter === 'practice' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Practice
                      </button>
                      <button
                        onClick={() => setCategoryFilter('free')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                          categoryFilter === 'free' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Free
                      </button>
                      <button
                        onClick={() => setCategoryFilter('paid')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                          categoryFilter === 'paid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Paid
                      </button>
                    </div>
                  </div>

                  {/* SQUARE SHAPED TOURNAMENT CARDS GRID (Matches user image specification) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredTournaments.map((tour, index) => {
                      const isSelected = activeTournament?.id === tour.id;
                      const isFull = tour.registeredCount >= tour.maxTeams;
                      const isOpen = tour.status === 'open';
                      const isRegistered = myRegistrations.some((registration) => registration.tournament.id === tour.id);
                      const entryFee = tour.category === 'paid' ? Number(tour.entryFeeAmount ?? tour.entryFee ?? 0) : 0;
                      const remainingSlots = Math.max(0, tour.maxTeams - tour.registeredCount);
                      const filledPercent = tour.maxTeams > 0 ? Math.min(100, (tour.registeredCount / tour.maxTeams) * 100) : 0;

                      // Background artwork selection
                      const bgImg =
                        tour.cardImageUrl ||
                        CARD_BACKGROUNDS[tour.category] || CARD_BACKGROUNDS.practice;

                      return (
                        <div
                          key={tour.id}
                          onClick={() => {
                            setActiveTournament(tour);
                          }}
                          className={`tournament-card relative aspect-square rounded-2xl overflow-hidden border transition-all cursor-pointer group flex flex-col justify-between p-3.5 sm:p-4 shadow-xl ${
                            isSelected
                              ? 'border-indigo-500 shadow-indigo-500/20 ring-2 ring-indigo-500/40 scale-[1.01]'
                              : 'border-[#25262f] hover:border-[#3a3b4a] bg-[#121520]'
                          }`}
                          style={{ animationDelay: `${index * 55}ms` }}
                        >
                          {/* Background PNG Image with Dark Gaming Vignette */}
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                            style={{ backgroundImage: `url(${bgImg})` }}
                          />
                          {/* Gradient Overlay for high text contrast */}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#09090d] via-[#09090d]/75 to-[#09090d]/40" />

                          {/* Top Badges */}
                          <div className="relative z-10 flex items-center justify-between gap-1">
                            <span
                              className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                tour.category === 'paid'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : tour.category === 'free'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                              }`}
                            >
                              {tour.category === 'paid'
                                ? 'PAID'
                                : tour.category === 'free'
                                ? 'FREE'
                                : 'PRACTICE'}
                            </span>

                            <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border ${isOpen ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-gray-500/20 text-gray-300 border-gray-500/40'}`}>{isOpen ? 'OPEN' : 'CLOSED'}</span>
                          </div>

                          {/* Center Scrim Details */}
                          <div className="relative z-10 text-center py-1">
                            <div className="text-[10px] text-gray-400">
                              {tour.date} ({tour.time})
                            </div>
                            {tour.category === 'paid' && tour.entryFee && <div className="mt-1 text-[10px] font-extrabold text-amber-200">Entry ৳{Number(tour.entryFee).toLocaleString()} / team</div>}
                          </div>

                          {/* Bottom Area: Prominent Title & Action (Matching image reference) */}
                          <div className="relative z-10 pt-2 border-t border-white/10 text-center">
                            <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider line-clamp-1 group-hover:text-indigo-300 transition-colors">
                              {tour.name}
                            </h4>

                            <div className="mt-2 flex items-center justify-center">
                              {isRegistered ? (
                                <button disabled onClick={(e) => e.stopPropagation()} className="w-full py-1.5 rounded-lg border border-cyan-300/15 bg-cyan-300/[.06] text-cyan-100 font-bold text-[10px] sm:text-xs cursor-default">
                                  ✓ Already Registered
                                </button>
                              ) : isOpen && !isFull && !PUBLIC_READ_ONLY && entryFee > walletBalance ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setShowWallet(true); }} className="w-full py-1.5 rounded-lg border border-amber-300/20 bg-amber-300/[.07] text-amber-100 font-bold text-[10px] sm:text-xs">
                                  Not enough money · ৳{entryFee} needed
                                </button>
                              ) : isOpen && !isFull && !PUBLIC_READ_ONLY ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRegistration(tour);
                                  }}
                                  className="w-full py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg text-[10px] sm:text-xs shadow-md transition-all"
                                >
                                  Register Squad
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTournament(tour);
                                    setActiveTab('registered_teams');
                                  }}
                                  className="w-full py-1.5 bg-[#1e1f27] text-gray-300 hover:text-white rounded-lg text-[10px] sm:text-xs font-semibold"
                                >
                                  View Teams
                                </button>
                              )}
                            </div>
                            <div className="mt-2 space-y-1.5 text-[9px] sm:text-[10px]">
                              <div className="flex items-center justify-between gap-2 font-semibold"><span className="text-slate-300">{tour.registeredCount}/{tour.maxTeams} teams</span><span className={remainingSlots ? 'text-emerald-300' : 'text-rose-300'}>{remainingSlots} {remainingSlots === 1 ? 'slot' : 'slots'} left</span></div>
                              <div role="progressbar" aria-label={`${tour.name} registration slots`} aria-valuemin={0} aria-valuemax={tour.maxTeams} aria-valuenow={tour.registeredCount} className="h-1.5 overflow-hidden rounded-full border border-white/10 bg-black/50"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-[width] duration-700 ease-out" style={{ width: `${filledPercent}%` }} /></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {filteredTournaments.length === 0 && (
                      <div className="col-span-full rounded-2xl border border-white/[.08] bg-white/[.025] px-5 py-10 text-center text-sm text-slate-400">
                        No tournaments with available slots right now.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: My Team + Top Teams */}
              <div className={PUBLIC_READ_ONLY ? 'hidden' : 'hidden lg:block lg:col-span-4 space-y-6'}>
                {/* MY TEAM CARD */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#1d1a1a] to-[#131419] border border-[#282934] rounded-2xl p-5 sm:p-6 shadow-xl">
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
                  <div className="relative flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 border border-indigo-400/40 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                      <Shield size={28} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-base text-white truncate">{teamProfile?.teamName || 'No team selected'}</h4>
                      <div className="text-xs text-gray-400 truncate">Leader: {teamProfile?.leaderName || 'Log in to view your team'}</div>
                    </div>
                  </div>

                  <div className="relative grid grid-cols-3 gap-2.5">
                    <div className="bg-[#0c0d11]/80 border border-[#22232c] p-3 rounded-xl text-center">
                      <div className="text-xl font-black text-amber-300">{myStanding ? myStanding.wins : 0}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">Wins</div>
                    </div>
                    <div className="bg-[#0c0d11]/80 border border-[#22232c] p-3 rounded-xl text-center">
                      <div className="text-xl font-black text-white">{myStanding ? myStanding.matches : 0}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">Matches</div>
                    </div>
                    <div className="bg-[#0c0d11]/80 border border-[#22232c] p-3 rounded-xl text-center">
                      <div className="text-xl font-black text-indigo-300">{myStanding ? `#${myStanding.rank}` : '—'}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">Rank</div>
                    </div>
                  </div>
                </div>

                {/* TOP TEAMS CARD */}
                <div className="bg-[#131620] border border-[#23242e] rounded-2xl p-5 sm:p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#20212a]">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <Trophy size={15} className="text-amber-400" /> Top Teams
                    </h4>
                    <button
                      onClick={() => setActiveTab('leaderboard')}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                    >
                      View all <ArrowRight size={12} />
                    </button>
                  </div>

                  {leaderboard.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">Ekhono kono match result nei.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {leaderboard.slice(0, 8).map((entry, i) => (
                        <div
                          key={entry.teamName}
                          className="flex items-center justify-between text-xs py-2 px-2.5 hover:bg-[#181c2b] rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[11px] shrink-0 ${
                                i === 0
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : i === 1
                                  ? 'bg-slate-400/20 text-slate-200'
                                  : i === 2
                                  ? 'bg-orange-500/20 text-orange-300'
                                  : 'bg-[#1e1f27] text-gray-400'
                              }`}
                            >
                              {i + 1}
                            </span>
                            <span className="font-semibold text-gray-200 truncate">{entry.teamName}</span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-[10px] text-amber-300 font-bold">{entry.wins}W</span>
                            <span className="font-mono font-bold text-gray-300">{entry.points}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEADERBOARD */}
          {activeTab === 'my_tournaments' && (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-200">Squad registrations</div><h2 className="mt-1 text-lg font-extrabold text-white">My Tournaments <span className="ml-1 text-sm text-slate-500">({myRegistrations.length})</span></h2></div><button type="button" onClick={() => { setActiveTab('tournaments'); setMobileMenuOpen(false); }} className="rounded-xl border border-indigo-300/15 px-3 py-2 text-[11px] font-bold text-indigo-200 transition hover:bg-indigo-300/[.08]">Browse tournaments</button></div>
              {myRegistrations.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-white/[.02] p-10 text-center"><CalendarDays size={26} className="mx-auto text-slate-600" /><h3 className="mt-3 text-sm font-bold text-white">No registrations yet</h3><p className="mt-1 text-xs text-slate-500">When your squad registers, tournaments will appear here.</p><button type="button" onClick={() => setActiveTab('tournaments')} className="mt-4 rounded-xl bg-indigo-500/15 px-4 py-2 text-xs font-bold text-indigo-200">Explore open tournaments</button></div> : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{myRegistrations.map(({ team, tournament }) => <button type="button" key={team.id} onClick={() => { setActiveTournament(tournament); setActiveTab('registered_teams'); setMobileMenuOpen(false); }} className="group rounded-2xl border border-white/[.08] bg-[#141720] p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-[#181c27] hover:shadow-xl hover:shadow-cyan-950/10"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/15 bg-cyan-300/[.06] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-cyan-200"><CheckCircle2 size={11} /> Registered</span><h3 className="mt-3 truncate text-sm font-extrabold text-white group-hover:text-cyan-100">{tournament.name}</h3></div><CalendarDays size={17} className="shrink-0 text-cyan-200/70" /></div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400"><span>{tournament.date}</span><span>{tournament.time}</span></div><div className="mt-4 flex items-center justify-between border-t border-white/[.06] pt-3 text-[10px]"><span className="truncate font-semibold text-slate-300">{team.teamName}</span><span className="text-cyan-200 transition group-hover:translate-x-0.5">View teams →</span></div></button>)}</div>
              )}
            </section>
          )}

          {activeTab === 'leaderboard' && (
            <LeaderboardView results={publishedResults} tournaments={tournaments} />
          )}

          {/* TAB 3: REGISTERED TEAMS VIEW */}
          {activeTab === 'registered_teams' && activeTournament && (
            <RegisteredTeamsView
              teams={currentTeams}
              tournament={activeTournament}
              onRegisterClick={PUBLIC_READ_ONLY || myRegistrations.some((registration) => registration.tournament.id === activeTournament.id) ? undefined : () => handleOpenRegistration(activeTournament || undefined)}
            />
          )}

          {/* TAB 4: PLAYER SEARCH VIEW */}
          {activeTab === 'player_search' && (
            <PlayerSearchView
              teams={allTeams}
              accounts={teamAccounts}
              tournaments={tournaments}
              matchResults={publishedResults}
            />
          )}
        </div>
      </div>

      {/* ================= MODALS ================= */}
      {showWallet && teamProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={() => setShowWallet(false)}>
          <section className="wallet-card w-full max-w-lg overflow-hidden rounded-3xl border border-amber-200/15 bg-[#111218] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-white/[.07] px-5 py-4">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><Wallet size={20} /></span><div><h2 className="font-bold">Team Wallet</h2><p className="text-[11px] text-slate-400">Prize earnings recorded by the organizer</p></div></div>
              <button type="button" onClick={() => setShowWallet(false)} aria-label="Close wallet" className="rounded-lg p-2 text-slate-400 hover:bg-white/[.06] hover:text-white"><CloseIcon size={17} /></button>
            </header>
            <div className="p-5">
              <div className="rounded-2xl border border-amber-300/15 bg-gradient-to-br from-amber-300/[.1] to-orange-500/[.03] p-5">
                <div className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-100/60">Available balance</div>
                <div className="mt-2 text-3xl font-black text-amber-100">৳{walletBalance.toLocaleString()}</div>
                <div className="mt-1 text-[10px] text-slate-500">Paid scrim fees are deducted automatically when your team registers.</div>
                {walletTotal > 0 && <div className="mt-3 border-t border-amber-200/10 pt-2 text-[11px] text-amber-100/70">Prize earnings recorded: ৳{walletTotal.toLocaleString()}</div>}
              </div>
              <section className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.035] p-4">
                <div className="text-sm font-extrabold text-white">Add Money</div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">Choose an amount and message the organizer at <span className="font-semibold text-emerald-200">01937679130</span>. Your wallet updates after verification.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select aria-label="Choose top-up amount" value={topUpSelection} onChange={(event) => setTopUpSelection(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#0b0c10] px-3 text-sm font-semibold text-white outline-none focus:border-emerald-300/35">
                    <option value="100">৳100</option><option value="200">৳200</option><option value="500">৳500</option><option value="1000">৳1,000</option><option value="2000">৳2,000</option><option value="custom">Custom amount</option>
                  </select>
                  {topUpSelection === 'custom' && <input aria-label="Custom top-up amount" type="number" min="1" step="1" value={customTopUpAmount} onChange={(event) => setCustomTopUpAmount(event.target.value)} placeholder="Amount (৳)" className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#0b0c10] px-3 text-sm text-white outline-none focus:border-emerald-300/35" />}
                  <button type="button" disabled={!Number.isFinite(requestedTopUpAmount) || requestedTopUpAmount <= 0} onClick={handleTopUpWhatsApp} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#128c58] px-4 text-xs font-extrabold text-white transition hover:bg-[#16a367] disabled:cursor-not-allowed disabled:opacity-45"><MessageCircle size={15} /> Request on WhatsApp</button>
                </div>
              </section>
              <div className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">Recent earnings</div>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {walletEntries.length ? walletEntries.map((result) => <div key={result.id} className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.025] px-3.5 py-3"><div className="min-w-0"><div className="truncate text-xs font-semibold text-white">{result.tournamentName}</div><div className="mt-1 text-[10px] text-slate-500">{result.createdAt ? new Date(result.createdAt).toLocaleDateString() : '—'}</div></div><div className="ml-3 text-sm font-extrabold text-emerald-300">+৳{Number(result.earnings).toLocaleString()}</div></div>) : <div className="rounded-xl border border-dashed border-white/[.08] py-7 text-center text-xs text-slate-500">No prize earnings recorded yet.</div>}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 1. Team Registration Modal (Auto-refilled, No tournament dropdown selector) */}
      {!PUBLIC_READ_ONLY && showRegModal && activeTournament && (
        <RegistrationModal
          tournament={activeTournament}
          walletBalance={walletBalance}
          onSuccess={handleRegisterSuccess}
          onClose={() => setShowRegModal(false)}
        />
      )}

      {/* 2. Registration Success Confirmation Modal */}
      {showSuccessModal && registeredSuccessTeam && activeTournament && (
        <RegistrationSuccessModal
          team={registeredSuccessTeam}
          tournament={activeTournament}
          onClose={() => setShowSuccessModal(false)}
        />
      )}

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
