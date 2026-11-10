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
  Copy,
  Check,
  LogOut,
  Edit3,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Tournament, Team, TournamentCategory, TeamProfile, MatchResult } from './types/tournament';
import {
  subscribeTournaments,
  subscribeTeams,
  subscribeMatchResults,
  buildLeaderboard,
  getLocalTeamProfile,
} from './services/tournamentService';
import { LeaderboardView } from './components/LeaderboardView';
import { testConnection } from './lib/firebase';
import { RegistrationModal } from './components/RegistrationModal';
import { RegistrationSuccessModal } from './components/RegistrationSuccessModal';
import { TeamLoginGate } from './components/TeamLoginGate';
import { PlayerSearchView } from './components/PlayerSearchView';
import { RegisteredTeamsView } from './components/RegisteredTeamsView';
import { AdminPanelModal } from './components/AdminPanelModal';

const PUBLIC_READ_ONLY = import.meta.env.PROD || import.meta.env.VITE_READ_ONLY_MODE === 'true';
const ADMIN_PANEL_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ADMIN_ENABLED === 'true';

// Free Fire Themed PNG Art / Illustrations for Square Cards
const CARD_BACKGROUNDS: Record<string, string> = {
  practice: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
  free: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&auto=format&fit=crop&q=80',
  paid: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80',
  bermuda: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
  purgatory: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&auto=format&fit=crop&q=80',
  kalahari: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80',
};

function MainApp() {
  const { isAdmin } = useAuth();

  // Navigation Views: 'tournaments' | 'leaderboard' | 'player_search' (+ 'registered_teams' opened from a tournament card)
  const [activeTab, setActiveTab] = useState<'tournaments' | 'leaderboard' | 'registered_teams' | 'player_search'>('tournaments');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TournamentCategory>('all');
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Secret Admin access via taps or long-press on mobile
  const [logoTapCount, setLogoTapCount] = useState(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Tournaments & Teams State from Firestore
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [currentTeams, setCurrentTeams] = useState<Team[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  // Captain / Team Profile State (for 1-click Auto-Refill)
  const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(() => getLocalTeamProfile());
  const [headerCopiedLink, setHeaderCopiedLink] = useState(false);

  // Modals
  const [showRegModal, setShowRegModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredSuccessTeam, setRegisteredSuccessTeam] = useState<Team | null>(null);
  const [isAdminPage, setIsAdminPage] = useState(() => ADMIN_PANEL_ENABLED && new URLSearchParams(window.location.search).get('panel') === 'admin');

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

  const handleCopyLoginLink = () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url);
    setHeaderCopiedLink(true);
    setTimeout(() => setHeaderCopiedLink(false), 2000);
  };

  const handleLogoutTeam = () => {
    localStorage.removeItem('ogxo7_captain_team_profile');
    setTeamProfile(null);
  };

  const handleOpenRegistration = (tour?: Tournament) => {
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

  // Subscribe to teams for the active tournament
  useEffect(() => {
    if (!activeTournament) return;
    const unsub = subscribeTeams(activeTournament.id, (teams) => {
      setCurrentTeams(teams);
      setAllTeams((prev) => {
        const others = prev.filter((t) => t.tournamentId !== activeTournament.id);
        return [...others, ...teams];
      });
    });
    return () => unsub();
  }, [activeTournament?.id]);

  // Filter tournaments by category
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      return categoryFilter === 'all' || (t.category || 'practice') === categoryFilter;
    });
  }, [tournaments, categoryFilter]);

  // Real leaderboard built from admin-entered match results
  const leaderboard = useMemo(() => buildLeaderboard(matchResults), [matchResults]);
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
  // Without login, nothing else is shown except the Login Form & Copy Link option
  if (!teamProfile && !PUBLIC_READ_ONLY) {
    return (
      <>
        <TeamLoginGate
          onLoginSuccess={(profile) => {
            setTeamProfile(profile);
          }}
          onOpenAdminSecret={openAdminPage}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e1117] text-white font-sans flex flex-col md:flex-row antialiased select-none pb-16 md:pb-0">
      {/* ================= CLEAN DESKTOP LEFT SIDEBAR ================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#11141c] border-r border-[#1e2330] flex flex-col justify-between py-6 px-4 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Gamepad2 size={18} className="text-white" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-wider text-white">OG x o7</span>
                <span className="block text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
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
              { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={17} />, tint: 'text-amber-400' },
              { key: 'player_search', label: 'Player Search', icon: <Search size={17} />, tint: 'text-emerald-400' },
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
                  className={`relative w-full flex items-center gap-3 px-3.5 py-3 text-[13px] font-bold rounded-xl transition-all ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/10 text-white border border-indigo-500/30 shadow-lg shadow-indigo-900/20'
                      : 'text-gray-400 hover:text-white hover:bg-[#161a25] border border-transparent'
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
          className="px-3 py-2 text-[11px] text-gray-500 cursor-default"
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
      <div className="flex-1 md:ml-64 flex flex-col min-w-0 bg-[#0e1117]">
        {/* TOP BAR / HEADER */}
        <header className="h-16 border-b border-[#1b1f2b] bg-[#11141c]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#1a1e2c]"
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
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center">
                <Gamepad2 size={16} className="text-white" />
              </div>
              <span className="font-extrabold text-sm tracking-wide text-white">OG x o7</span>
            </div>

            {/* Desktop View Tabs */}
            <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm">
              {[
                { key: 'tournaments', label: 'Tournaments' },
                { key: 'leaderboard', label: 'Leaderboard' },
                { key: 'player_search', label: 'Player Search' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveTab(item.key as any);
                    if (item.key === 'tournaments') setCategoryFilter('all');
                  }}
                  className={`font-bold pb-1 transition-all ${
                    activeTab === item.key
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right Header: Team Profile, Copy Link & Quick Register */}
          <div className="flex items-center gap-2 sm:gap-3">
            {!PUBLIC_READ_ONLY && <>
            {/* Copy Login Link Button */}
            <button
              onClick={handleCopyLoginLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171a27] hover:bg-[#212638] border border-[#2b334a] text-indigo-300 hover:text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              title="Copy Team Login Link to share with other squad captains"
            >
              {headerCopiedLink ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className="hidden sm:inline">Copy Login Link</span>
                </>
              )}
            </button>

            {/* Team Profile Pill */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-[#161a26] border border-[#2b3249] rounded-xl text-xs">
              <Shield size={14} className="text-indigo-400 shrink-0" />
              <span className="font-bold text-white max-w-[90px] sm:max-w-[120px] truncate">
                {teamProfile.teamName}
              </span>
            </div>

            {/* Switch / Logout Team */}
            <button
              onClick={handleLogoutTeam}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#1f2434] rounded-lg transition-colors"
              title="Logout / Switch Team"
            >
              <LogOut size={16} />
            </button>

            {/* Register Team Button */}
            <button
              onClick={() => handleOpenRegistration(activeTournament || undefined)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all shrink-0"
            >
              Register Team
            </button>
            </>}
          </div>
        </header>

        {/* ================= BODY CONTENT AREA ================= */}
        <div className="app-main-content flex-1 p-3.5 sm:p-6 lg:p-8 overflow-y-auto">
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
                    <div className="flex items-center gap-1 bg-[#10131d] p-1 rounded-xl border border-[#212638] text-xs shrink-0">
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
                      const remainingSlots = Math.max(0, tour.maxTeams - tour.registeredCount);

                      // Background artwork selection
                      const bgImg =
                        tour.cardImageUrl ||
                        CARD_BACKGROUNDS[tour.category] ||
                        CARD_BACKGROUNDS[tour.map?.toLowerCase() || 'bermuda'] ||
                        CARD_BACKGROUNDS.practice;

                      return (
                        <div
                          key={tour.id}
                          onClick={() => {
                            setActiveTournament(tour);
                          }}
                          className={`relative aspect-square rounded-2xl overflow-hidden border transition-all cursor-pointer group flex flex-col justify-between p-3.5 sm:p-4 shadow-xl ${
                            isSelected
                              ? 'border-indigo-500 shadow-indigo-500/20 ring-2 ring-indigo-500/40 scale-[1.01]'
                              : 'border-[#22273a] hover:border-[#384260] bg-[#121520]'
                          }`}
                        >
                          {/* Background PNG Image with Dark Gaming Vignette */}
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                            style={{ backgroundImage: `url(${bgImg})` }}
                          />
                          {/* Gradient Overlay for high text contrast */}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/75 to-[#0b0e14]/40" />

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

                            <span
                              className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isFull
                                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                  : isOpen
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-gray-500/20 text-gray-300 border-gray-500/40'
                              }`}
                            >
                              {isFull ? 'FULL' : `${remainingSlots} LEFT`}
                            </span>
                          </div>

                          {/* Center Scrim Details */}
                          <div className="relative z-10 text-center py-1">
                            <div className="text-[10px] font-semibold text-gray-300 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full inline-block mb-1 border border-white/10">
                              {tour.map || 'Bermuda'} • {tour.registeredCount}/{tour.maxTeams} Teams
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {tour.date} ({tour.time})
                            </div>
                          </div>

                          {/* Bottom Area: Prominent Title & Action (Matching image reference) */}
                          <div className="relative z-10 pt-2 border-t border-white/10 text-center">
                            <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider line-clamp-1 group-hover:text-indigo-300 transition-colors">
                              {tour.name}
                            </h4>

                            <div className="mt-2 flex items-center justify-center">
                              {isOpen && !isFull && !PUBLIC_READ_ONLY ? (
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
                                  className="w-full py-1.5 bg-[#1b2030] text-gray-300 hover:text-white rounded-lg text-[10px] sm:text-xs font-semibold"
                                >
                                  View Teams
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: My Team + Top Teams */}
              <div className={PUBLIC_READ_ONLY ? 'hidden' : 'hidden lg:block lg:col-span-4 space-y-6'}>
                {/* MY TEAM CARD */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#1a1f33] to-[#141722] border border-[#262c3e] rounded-2xl p-5 sm:p-6 shadow-xl">
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
                  <div className="relative flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 border border-indigo-400/40 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                      <Shield size={28} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-base text-white truncate">{teamProfile.teamName}</h4>
                      <div className="text-xs text-gray-400 truncate">Leader: {teamProfile.leaderName}</div>
                    </div>
                  </div>

                  <div className="relative grid grid-cols-3 gap-2.5">
                    <div className="bg-[#0e1118]/80 border border-[#202536] p-3 rounded-xl text-center">
                      <div className="text-xl font-black text-amber-300">{myStanding ? myStanding.wins : 0}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">Wins</div>
                    </div>
                    <div className="bg-[#0e1118]/80 border border-[#202536] p-3 rounded-xl text-center">
                      <div className="text-xl font-black text-white">{myStanding ? myStanding.matches : 0}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">Matches</div>
                    </div>
                    <div className="bg-[#0e1118]/80 border border-[#202536] p-3 rounded-xl text-center">
                      <div className="text-xl font-black text-indigo-300">{myStanding ? `#${myStanding.rank}` : '—'}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">Rank</div>
                    </div>
                  </div>
                </div>

                {/* TOP TEAMS CARD */}
                <div className="bg-[#131620] border border-[#212638] rounded-2xl p-5 sm:p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1e2334]">
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
                                  : 'bg-[#1b2030] text-gray-400'
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
          {activeTab === 'leaderboard' && (
            <LeaderboardView results={matchResults} tournaments={tournaments} />
          )}

          {/* TAB 3: REGISTERED TEAMS VIEW */}
          {activeTab === 'registered_teams' && activeTournament && (
            <RegisteredTeamsView
              teams={currentTeams}
              tournament={activeTournament}
              onRegisterClick={PUBLIC_READ_ONLY ? undefined : () => handleOpenRegistration(activeTournament || undefined)}
            />
          )}

          {/* TAB 4: PLAYER SEARCH VIEW */}
          {activeTab === 'player_search' && (
            <PlayerSearchView
              teams={allTeams.length > 0 ? allTeams : currentTeams}
              tournaments={tournaments}
            />
          )}
        </div>
      </div>

      {/* ================= STICKY MOBILE BOTTOM NAVIGATION BAR ================= */}
      {/* Enables comfortable, native app-like mobile browsing */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#10131c]/95 backdrop-blur-md border-t border-[#1f2434] px-2 py-1.5 flex items-center justify-around text-[10px]">
        {[
          { key: 'tournaments', label: 'Tournaments', icon: <Flame size={20} /> },
          { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> },
          { key: 'player_search', label: 'Search', icon: <Search size={20} /> },
        ].map((item) => {
          const active = activeTab === item.key || (item.key === 'tournaments' && activeTab === 'registered_teams');
          return (
            <button
              key={item.key}
              onClick={() => {
                setActiveTab(item.key as any);
                if (item.key === 'tournaments') setCategoryFilter('all');
              }}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${
                active ? 'text-indigo-400 font-bold' : 'text-gray-400'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ================= MODALS ================= */}
      {/* 1. Team Registration Modal (Auto-refilled, No tournament dropdown selector) */}
      {!PUBLIC_READ_ONLY && showRegModal && activeTournament && (
        <RegistrationModal
          tournament={activeTournament}
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
