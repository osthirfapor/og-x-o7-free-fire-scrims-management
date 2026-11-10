import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Lock,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  Send,
  Link,
  Users,
  Settings,
  ListFilter,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  LogOut,
  Sliders,
  Trophy,
  Crown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Tournament, Team, RegistrationLog, Player, MatchResult } from '../types/tournament';
import { RegistrationModal } from './RegistrationModal';
import {
  createTournament,
  updateTournament,
  deleteTournament,
  updateTeam,
  deleteTeam,
  subscribeRegistrationLogs,
  subscribeMatchResults,
  addMatchResult,
  deleteMatchResult,
  calcPoints,
  buildLeaderboard,
} from '../services/tournamentService';

interface Props {
  tournaments: Tournament[];
  teams: Team[];
  activeTournament: Tournament;
  onSelectTournament: (t: Tournament) => void;
  onClose: () => void;
  standalone?: boolean;
}

const MAP_OPTIONS = ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NexTerra'];

export const AdminPanelModal: React.FC<Props> = ({
  tournaments,
  teams,
  activeTournament,
  onSelectTournament,
  onClose,
  standalone = false,
}) => {
  const { isAdmin, loginWithCredentials, logout, loading: authLoading } = useAuth();

  // Authentication State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Tab State
  const [tab, setTab] = useState<'overview' | 'teams' | 'results' | 'tournament' | 'redirect' | 'discord' | 'logs'>('overview');

  // Selected Tournament for Admin Action
  const [currentTour, setCurrentTour] = useState<Tournament>(activeTournament);

  // Tournament Editing State
  const [tourName, setTourName] = useState(currentTour.name);
  const [tourDate, setTourDate] = useState(currentTour.date);
  const [tourTime, setTourTime] = useState(currentTour.time);
  const [tourMaxTeams, setTourMaxTeams] = useState(currentTour.maxTeams);
  const [tourStatus, setTourStatus] = useState(currentTour.status);
  const [tourMap, setTourMap] = useState(currentTour.map || 'Bermuda');
  const [tourCardImage, setTourCardImage] = useState(currentTour.cardImageUrl || '');
  const [saveTourSuccess, setSaveTourSuccess] = useState(false);

  // Redirect Link State
  const [redirectLink, setRedirectLink] = useState(currentTour.redirectLink || '');
  const [redirectEnabled, setRedirectEnabled] = useState(currentTour.redirectLinkEnabled ?? true);
  const [redirectBtnText, setRedirectBtnText] = useState(currentTour.redirectButtonText || 'Join Scrims Group');
  const [saveRedirectSuccess, setSaveRedirectSuccess] = useState(false);

  // New Tournament Modal State
  const [showCreateTour, setShowCreateTour] = useState(false);
  const [newTourName, setNewTourName] = useState('');
  const [newTourDate, setNewTourDate] = useState('');
  const [newTourTime, setNewTourTime] = useState('18:00 UTC');
  const [newTourMax, setNewTourMax] = useState(12);
  const [newTourMap, setNewTourMap] = useState<string[]>(['Bermuda']);
  const [newTourCategory, setNewTourCategory] = useState<'practice' | 'free' | 'paid'>('practice');
  const [newTourGroupLink, setNewTourGroupLink] = useState('');
  const [newTourCardImage, setNewTourCardImage] = useState('');

  // Discord Webhook State
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [discordMasked, setDiscordMasked] = useState('');
  const [discordTestStatus, setDiscordTestStatus] = useState<string | null>(null);
  const [discordTestLoading, setDiscordTestLoading] = useState(false);

  // Team Edit Modal State
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editLeaderName, setEditLeaderName] = useState('');

  // Logs State
  const [logs, setLogs] = useState<RegistrationLog[]>([]);
  const [showAdminRegistration, setShowAdminRegistration] = useState(false);

  // Search Filter in Teams tab
  const [teamSearch, setTeamSearch] = useState('');

  // Match Results & Ranking State
  const [results, setResults] = useState<MatchResult[]>([]);
  const [resTeam, setResTeam] = useState('');
  const [resPosition, setResPosition] = useState(1);
  const [resKills, setResKills] = useState(0);
  const [resEarnings, setResEarnings] = useState(0);
  const [resSaving, setResSaving] = useState(false);
  const [resMsg, setResMsg] = useState<string | null>(null);

  // Sync when activeTournament changes
  useEffect(() => {
    setCurrentTour(activeTournament);
    setTourName(activeTournament.name);
    setTourDate(activeTournament.date);
    setTourTime(activeTournament.time);
    setTourMaxTeams(activeTournament.maxTeams);
    setTourStatus(activeTournament.status);
    setTourMap(activeTournament.map || 'Bermuda');
    setTourCardImage(activeTournament.cardImageUrl || '');
    setRedirectLink(activeTournament.redirectLink || '');
    setRedirectEnabled(activeTournament.redirectLinkEnabled ?? true);
    setRedirectBtnText(activeTournament.redirectButtonText || 'Join Scrims Group');
  }, [activeTournament]);

  // Load privileged data only after Firebase confirms this user is an admin.
  useEffect(() => {
    if (!isAdmin) {
      setLogs([]);
      setResults([]);
      return;
    }

    fetch('/api/admin/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.discordWebhookMasked) {
          setDiscordMasked(data.discordWebhookMasked);
        }
      })
      .catch((e) => console.log('Config load:', e));

    const unsubLogs = subscribeRegistrationLogs((fetchedLogs) => {
      setLogs(fetchedLogs);
    });
    const unsubResults = subscribeMatchResults((r) => setResults(r));
    return () => {
      unsubLogs();
      unsubResults();
    };
  }, [isAdmin]);

  // Firebase Authentication + Firestore admin allowlist
  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      await loginWithCredentials(email, password);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not sign in. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  // Switch tournament
  const handleSelectTournament = (tour: Tournament) => {
    setCurrentTour(tour);
    onSelectTournament(tour);
    setTourName(tour.name);
    setTourDate(tour.date);
    setTourTime(tour.time);
    setTourMaxTeams(tour.maxTeams);
    setTourStatus(tour.status);
    setTourMap(tour.map || 'Bermuda');
    setTourCardImage(tour.cardImageUrl || '');
    setRedirectLink(tour.redirectLink || '');
    setRedirectEnabled(tour.redirectLinkEnabled ?? true);
    setRedirectBtnText(tour.redirectButtonText || 'Join Scrims Group');
  };

  // Toggle Tournament Open/Closed
  const toggleRegistration = async () => {
    const nextStatus = currentTour.status === 'open' ? 'closed' : 'open';
    try {
      await updateTournament(currentTour.id, { status: nextStatus });
      setTourStatus(nextStatus);
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // Save Tournament Info
  const handleSaveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateTournament(currentTour.id, {
        name: tourName,
        date: tourDate,
        time: tourTime,
        maxTeams: Number(tourMaxTeams),
        status: tourStatus,
        map: tourMap,
        cardImageUrl: tourCardImage.trim(),
      });
      setSaveTourSuccess(true);
      setTimeout(() => setSaveTourSuccess(false), 2500);
    } catch (err: any) {
      alert(`Error updating tournament: ${err.message}`);
    }
  };

  // Save Redirect Link
  const handleSaveRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateTournament(currentTour.id, {
        redirectLink: redirectLink.trim(),
        redirectLinkEnabled: redirectEnabled,
        redirectButtonText: redirectBtnText.trim(),
      });
      setSaveRedirectSuccess(true);
      setTimeout(() => setSaveRedirectSuccess(false), 2500);
    } catch (err: any) {
      alert(`Error updating redirect link: ${err.message}`);
    }
  };

  // Remove Redirect Link
  const handleRemoveRedirect = async () => {
    try {
      await updateTournament(currentTour.id, {
        redirectLink: '',
        redirectLinkEnabled: false,
      });
      setRedirectLink('');
      setRedirectEnabled(false);
      setSaveRedirectSuccess(true);
      setTimeout(() => setSaveRedirectSuccess(false), 2500);
    } catch (err: any) {
      alert(`Error removing redirect: ${err.message}`);
    }
  };

  // Create New Tournament
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourName.trim()) return;
    try {
      const newId = await createTournament({
        name: newTourName.trim(),
        category: newTourCategory,
        date: newTourDate || new Date().toISOString().split('T')[0],
        time: newTourTime || '18:00 UTC',
        maxTeams: Number(newTourMax) || 12,
        map: newTourMap.join(', ') || 'Bermuda',
        redirectLink: newTourGroupLink.trim(),
        redirectLinkEnabled: Boolean(newTourGroupLink.trim()),
        redirectButtonText: 'Join Official Discord Lounge',
        cardImageUrl: newTourCardImage.trim(),
      });
      setShowCreateTour(false);
      setNewTourName('');
      setNewTourGroupLink('');
      setNewTourCardImage('');
      setNewTourMap(['Bermuda']);
      alert('New tournament scrim successfully created!');
    } catch (err: any) {
      alert(`Failed to create tournament: ${err.message}`);
    }
  };

  // Delete Tournament
  const handleDeleteTournament = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this tournament and its registrations?')) {
      try {
        await deleteTournament(id);
      } catch (err: any) {
        alert(`Failed to delete tournament: ${err.message}`);
      }
    }
  };

  // Team Actions: Approve / Reject
  const handleTeamStatus = async (team: Team, nextStatus: 'approved' | 'rejected' | 'pending') => {
    try {
      await updateTeam(team.tournamentId, team.id, { status: nextStatus });
    } catch (err: any) {
      alert(`Failed to update team: ${err.message}`);
    }
  };

  // Team Actions: Delete
  const handleDeleteTeam = async (team: Team) => {
    if (confirm(`Remove team "${team.teamName}"? This will decrement registered count and open a slot.`)) {
      try {
        await deleteTeam(team.tournamentId, team.id);
      } catch (err: any) {
        alert(`Failed to delete team: ${err.message}`);
      }
    }
  };

  // Team Edit Submit
  const handleEditTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    try {
      await updateTeam(editingTeam.tournamentId, editingTeam.id, {
        teamName: editTeamName.trim(),
        leaderName: editLeaderName.trim(),
      });
      setEditingTeam(null);
    } catch (err: any) {
      alert(`Failed to edit team: ${err.message}`);
    }
  };

  // Discord Webhook Save & Test
  const handleSaveDiscord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discordWebhookUrl.trim()) return;
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordWebhookUrl: discordWebhookUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscordMasked(discordWebhookUrl.replace(/(webhooks\/\d+\/)(.+)/, '$1••••••••'));
        setDiscordWebhookUrl('');
        setDiscordTestStatus('Webhook URL saved to server relay.');
      }
    } catch (e: any) {
      alert('Failed to save webhook: ' + e.message);
    }
  };

  const handleTestDiscord = async () => {
    setDiscordTestLoading(true);
    setDiscordTestStatus(null);
    try {
      const res = await fetch('/api/admin/discord-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: discordWebhookUrl || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscordTestStatus('✅ Test message sent! Check your Discord channel.');
      } else {
        setDiscordTestStatus(`❌ Discord error: ${data.error}`);
      }
    } catch (e: any) {
      setDiscordTestStatus(`❌ Failed to send test: ${e.message}`);
    } finally {
      setDiscordTestLoading(false);
    }
  };

  // Match result handlers
  const handleAddResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setResMsg(null);
    if (!resTeam) {
      setResMsg('Age ekta team select korun.');
      return;
    }
    setResSaving(true);
    try {
      await addMatchResult({
        tournamentId: currentTour.id,
        tournamentName: currentTour.name,
        teamName: resTeam,
        position: Number(resPosition),
        kills: Math.max(0, Number(resKills) || 0),
        earnings: Math.max(0, Number(resEarnings) || 0),
      });
      setResMsg(`✅ ${resTeam} — Rank #${resPosition} saved.`);
      setResKills(0);
      setResEarnings(0);
      setResPosition((p) => Math.min(12, p + 1));
      setResTeam('');
      setTimeout(() => setResMsg(null), 3000);
    } catch (err: any) {
      setResMsg(`❌ ${err.message}`);
    } finally {
      setResSaving(false);
    }
  };

  const handleDeleteResult = async (r: MatchResult) => {
    if (confirm(`"${r.teamName}" er result (Rank #${r.position}) delete korben?`)) {
      try {
        await deleteMatchResult(r.id);
      } catch (err: any) {
        alert(`Failed to delete result: ${err.message}`);
      }
    }
  };

  const tourResults = results
    .filter((r) => r.tournamentId === currentTour.id)
    .sort((a, b) => a.position - b.position || b.kills - a.kills);
  const overallBoard = buildLeaderboard(results);

  // Filter teams for current tournament
  const currentTourTeams = teams.filter((t) => t.tournamentId === currentTour.id);
  const searchedTeams = currentTourTeams.filter((t) => {
    const q = teamSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      t.teamName.toLowerCase().includes(q) ||
      t.leaderName.toLowerCase().includes(q) ||
      t.registrationId.toLowerCase().includes(q)
    );
  });

  return (
    <div className={standalone ? 'fixed inset-0 z-50 h-screen w-screen overflow-auto bg-[#0b0e14] animate-fade-in' : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fade-in'}>
      <div className={`relative w-full ${standalone ? 'min-h-screen max-w-none rounded-none border-0 shadow-none' : 'max-w-5xl max-h-[92vh] mx-auto rounded-2xl border border-[#262c3e] shadow-2xl'} bg-[#12151f] p-5 sm:p-7 text-white flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#212638]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Shield size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">OG x o7 Admin Dashboard</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Organizer Access
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Manage Free Fire scrims, approve teams, adjust slots, and configure Discord alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white bg-[#1a1e2c] rounded-lg hover:bg-[#23283a] transition-colors"
                title="Log out of admin session"
              >
                <LogOut size={14} /> Log out
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#202536] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* If NOT Admin, Show Secure Login Screen */}
        {authLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Checking Firebase admin access…</div>
        ) : !isAdmin ? (
          <div className="py-12 px-4 max-w-md mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.2)]">
              <Lock size={30} />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Admin Authentication Required</h3>
              <p className="text-xs text-gray-400 mt-1">
                Sign in with the Firebase account approved for admin access.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">
                {authError}
              </div>
            )}

            {/* Firebase admin account credentials */}
            <form onSubmit={handlePasscodeSubmit} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="Admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-4 py-2.5 text-sm text-center text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                />
              </div>
              <div>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-4 py-2.5 text-sm text-center text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                />
              </div>
              <button
                type="submit"
                disabled={authBusy || !email.trim() || !password}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition-all"
              >
                {authBusy ? 'Signing in…' : 'Sign in to Admin Dashboard'}
              </button>
            </form>
          </div>
        ) : (
          /* Logged In Admin Dashboard */
          <div className="flex-1 overflow-hidden flex flex-col mt-4">
            {/* Top Scrim Selector & Quick Controls */}
            <div className="bg-[#0e1119] border border-[#212638] rounded-xl p-3 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-medium">Selected Scrim:</span>
                <select
                  value={currentTour.id}
                  onChange={(e) => {
                    const match = tournaments.find((t) => t.id === e.target.value);
                    if (match) handleSelectTournament(match);
                  }}
                  className="bg-[#181c28] border border-[#2b3249] rounded-lg px-3 py-1 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                >
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.status.toUpperCase()} • {t.registeredCount}/{t.maxTeams})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowCreateTour(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-lg hover:bg-indigo-600/30 transition-colors"
                >
                  <Plus size={13} /> New Scrim
                </button>
              </div>

              {/* Status Switcher & Capacity quick indicators */}
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-400">
                  Slots: <span className="text-white font-bold">{currentTour.registeredCount}</span> /{' '}
                  <span className="text-white font-bold">{currentTour.maxTeams}</span> Teams
                </div>

                <button
                  onClick={toggleRegistration}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                    currentTour.status === 'open'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                  }`}
                >
                  {currentTour.status === 'open' ? '🟢 Registration OPEN' : '🔴 Registration CLOSED'}
                </button>
              </div>
            </div>

            {/* Admin Tabs */}
            <div className="flex items-center gap-2 border-b border-[#212638] pb-2 overflow-x-auto text-xs">
              <button
                onClick={() => setTab('overview')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
                  tab === 'overview' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setTab('teams')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
                  tab === 'teams' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Registered Teams ({currentTourTeams.length})
              </button>
              <button
                onClick={() => setTab('results')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
                  tab === 'results' ? 'bg-amber-600 text-white' : 'text-amber-300/80 hover:text-white'
                }`}
              >
                🏆 Results & Ranking ({tourResults.length})
              </button>
              <button
                onClick={() => setTab('tournament')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
                  tab === 'tournament' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Tournament Info & Slots
              </button>
              <button
                onClick={() => setTab('redirect')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
                  tab === 'redirect' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Redirect Link
              </button>
              <button
                onClick={() => setTab('discord')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
                  tab === 'discord' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Discord Webhook Relay
              </button>
              <button
                onClick={() => setTab('logs')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
                  tab === 'logs' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Registration Logs ({logs.length})
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto mt-4 pr-1">
              {/* TAB 1: OVERVIEW */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#151926] p-4 rounded-xl border border-[#242b3e]">
                      <div className="text-xs text-gray-400">Total Scrims</div>
                      <div className="text-2xl font-bold text-white mt-1">{tournaments.length}</div>
                    </div>
                    <div className="bg-[#151926] p-4 rounded-xl border border-[#242b3e]">
                      <div className="text-xs text-gray-400">Registered Teams</div>
                      <div className="text-2xl font-bold text-indigo-400 mt-1">{currentTourTeams.length}</div>
                    </div>
                    <div className="bg-[#151926] p-4 rounded-xl border border-[#242b3e]">
                      <div className="text-xs text-gray-400">Remaining Slots</div>
                      <div className="text-2xl font-bold text-emerald-400 mt-1">
                        {Math.max(0, currentTour.maxTeams - currentTour.registeredCount)}
                      </div>
                    </div>
                    <div className="bg-[#151926] p-4 rounded-xl border border-[#242b3e]">
                      <div className="text-xs text-gray-400">Total Players</div>
                      <div className="text-2xl font-bold text-purple-400 mt-1">
                        {currentTourTeams.length * 5} / {currentTour.maxTeams * 5}
                      </div>
                    </div>
                  </div>

                  {/* Scrims List in Overview */}
                  <div className="bg-[#151926] border border-[#242b3e] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        All Tournaments & Scrims
                      </h4>
                      <button
                        onClick={() => setShowCreateTour(true)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        + Create Scrim
                      </button>
                    </div>

                    <div className="divide-y divide-[#202536]">
                      {tournaments.map((t) => (
                        <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="font-bold text-white text-sm">{t.name}</div>
                            <div className="text-gray-400 mt-0.5">
                              {t.date} • {t.time} • Map: {t.map || 'Bermuda'}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded font-bold uppercase ${
                                t.status === 'open'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              {t.status}
                            </span>
                            <span className="font-bold text-white">
                              {t.registeredCount} / {t.maxTeams} Teams
                            </span>
                            <button
                              onClick={() => handleSelectTournament(t)}
                              className="px-2.5 py-1 bg-[#1e2334] hover:bg-[#272e44] text-indigo-300 rounded font-semibold transition-colors"
                            >
                              Manage
                            </button>
                            {tournaments.length > 1 && (
                              <button
                                onClick={() => handleDeleteTournament(t.id)}
                                className="text-gray-500 hover:text-red-400 p-1"
                                title="Delete Tournament"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TEAMS MANAGEMENT */}
              {tab === 'teams' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <input
                      type="text"
                      placeholder="Filter teams by name, leader, or Registration ID..."
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      className="w-full sm:w-80 bg-[#0d1017] border border-[#262c3e] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex items-center gap-3 ml-auto">
                      <div className="text-xs text-gray-400">
                        Total: <span className="text-white font-bold">{searchedTeams.length}</span> Teams
                      </div>
                      <button
                        type="button"
                        disabled={!currentTour.id || currentTour.status !== 'open' || currentTour.registeredCount >= currentTour.maxTeams}
                        onClick={() => setShowAdminRegistration(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus size={13} /> Register Squad
                      </button>
                    </div>
                  </div>

                  {searchedTeams.length === 0 ? (
                    <div className="bg-[#151926] p-8 rounded-xl text-center text-gray-400 text-xs">
                      No registered teams found for this scrim.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {searchedTeams.map((team, idx) => (
                        <div
                          key={team.id}
                          className="bg-[#151926] border border-[#242b3e] p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-indigo-400 bg-[#0f121a] px-2 py-0.5 rounded border border-[#212638]">
                                #{idx + 1} • {team.registrationId}
                              </span>
                              <h4 className="text-sm font-bold text-white">{team.teamName}</h4>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                  team.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : team.status === 'rejected'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {team.status}
                              </span>
                            </div>

                            <div className="text-xs text-gray-400 mt-1">
                              Leader: <span className="text-gray-200 font-semibold">{team.leaderName}</span>
                            </div>

                            {/* Squad list preview */}
                            <div className="text-[11px] text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              {team.players.map((p, pIdx) => (
                                <span key={pIdx}>
                                  {p.role === 'backup' ? '🔄' : '👤'} {p.name}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            {team.status !== 'approved' && (
                              <button
                                onClick={() => handleTeamStatus(team, 'approved')}
                                className="px-2.5 py-1 text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30"
                              >
                                Approve
                              </button>
                            )}
                            {team.status !== 'rejected' && (
                              <button
                                onClick={() => handleTeamStatus(team, 'rejected')}
                                className="px-2.5 py-1 text-xs font-semibold bg-red-600/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-600/30"
                              >
                                Reject
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingTeam(team);
                                setEditTeamName(team.teamName);
                                setEditLeaderName(team.leaderName);
                              }}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#202536] rounded-lg"
                              title="Edit Team"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#202536] rounded-lg"
                              title="Delete Team & Free Slot"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: MATCH RESULTS & RANKING */}
              {tab === 'results' && (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                  <div className="xl:col-span-2 space-y-4">
                    <form onSubmit={handleAddResult} className="bg-[#151926] border border-[#242b3e] rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy size={14} /> Add Match Result
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Scrim: <span className="text-white font-semibold">{currentTour.name}</span>. Rank 1 = Winner (Booyah) — leaderboard e win count hobe.
                      </p>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Team</label>
                        <select
                          value={resTeam}
                          onChange={(e) => setResTeam(e.target.value)}
                          className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">— Select registered team —</option>
                          {currentTourTeams.map((t) => (
                            <option key={t.id} value={t.teamName}>
                              {t.teamName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Ranking / Position</label>
                          <select
                            value={resPosition}
                            onChange={(e) => setResPosition(Number(e.target.value))}
                            className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n === 1 ? '#1 — Winner 👑' : `#${n}`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Kills</label>
                          <input
                            type="number"
                            min="0"
                            value={resKills}
                            onChange={(e) => setResKills(Number(e.target.value))}
                            className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Team earnings (৳)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={resEarnings}
                          onChange={(e) => setResEarnings(Number(e.target.value))}
                          placeholder="0"
                          className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex items-center justify-between bg-[#0d1017] border border-[#22273a] rounded-xl px-3 py-2 text-xs">
                        <span className="text-gray-400">Points (auto)</span>
                        <span className="font-mono font-bold text-indigo-300">{calcPoints(resPosition, resKills)} pts</span>
                      </div>

                      {resMsg && <div className="text-xs text-gray-200 bg-[#0f121b] border border-[#262c3e] rounded-lg px-3 py-2">{resMsg}</div>}

                      <button
                        type="submit"
                        disabled={resSaving}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all"
                      >
                        {resSaving ? 'Saving...' : 'Save Result'}
                      </button>
                    </form>

                    <div className="bg-[#151926] border border-[#242b3e] rounded-xl p-4">
                      <div className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Overall Wins Ranking</div>
                      {overallBoard.length === 0 ? (
                        <p className="text-xs text-gray-500">Kono result nei.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {overallBoard.slice(0, 10).map((e, i) => (
                            <div key={e.teamName} className="flex items-center justify-between text-xs bg-[#0f121a] border border-[#1e2333] rounded-lg px-3 py-2">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="font-black text-gray-500 w-4">{i + 1}</span>
                                <span className="font-semibold text-white truncate">{e.teamName}</span>
                              </span>
                              <span className="text-gray-400 shrink-0">
                                <span className="text-amber-300 font-bold">{e.wins}W</span> • {e.matches} played • {e.points} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="xl:col-span-3 bg-[#151926] border border-[#242b3e] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Results — {currentTour.name}</div>
                      <span className="text-[11px] text-gray-400">{tourResults.length} entries</span>
                    </div>

                    {tourResults.length === 0 ? (
                      <div className="text-center text-xs text-gray-500 py-10">Ei scrim er kono result add kora hoyni.</div>
                    ) : (
                      <div className="space-y-2">
                        {tourResults.map((r) => (
                          <div
                            key={r.id}
                            className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs ${
                              r.position === 1 ? 'bg-amber-500/5 border-amber-500/30' : 'bg-[#0f121a] border-[#1e2333]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-black shrink-0 ${
                                  r.position === 1 ? 'bg-amber-500/20 text-amber-300' : 'bg-[#1b2030] text-gray-300'
                                }`}
                              >
                                {r.position === 1 ? <Crown size={15} /> : `#${r.position}`}
                              </span>
                              <div className="min-w-0">
                                <div className="font-bold text-white text-sm truncate">{r.teamName}</div>
                                <div className="text-gray-400">
                                  {r.kills} kills • <span className="text-indigo-300 font-mono">{r.points} pts</span>
                                  {(r.earnings || 0) > 0 && <span className="ml-2 text-emerald-300 font-semibold">৳{Number(r.earnings).toLocaleString()}</span>}
                                  {r.position === 1 && <span className="ml-2 text-amber-300 font-bold">WINNER</span>}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteResult(r)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-[#202536] rounded-lg shrink-0"
                              title="Delete result"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: TOURNAMENT INFO & CAPACITY */}
              {tab === 'tournament' && (
                <form onSubmit={handleSaveTournament} className="space-y-4 max-w-xl">
                  {saveTourSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                      <Check size={16} /> Tournament parameters saved successfully!
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                      Tournament Name
                    </label>
                    <input
                      type="text"
                      value={tourName}
                      onChange={(e) => setTourName(e.target.value)}
                      className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                        Date
                      </label>
                      <input
                        type="text"
                        value={tourDate}
                        onChange={(e) => setTourDate(e.target.value)}
                        placeholder="e.g. Nov 09, 2026"
                        className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                        Start Time
                      </label>
                      <input
                        type="text"
                        value={tourTime}
                        onChange={(e) => setTourTime(e.target.value)}
                        placeholder="e.g. 18:00 UTC"
                        className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                        Max Teams (Capacity)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="48"
                        value={tourMaxTeams}
                        onChange={(e) => setTourMaxTeams(Number(e.target.value))}
                        className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Maps</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {MAP_OPTIONS.map((map) => {
                          const selected = tourMap.split(',').map((value) => value.trim()).includes(map);
                          return (
                            <label key={map} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${selected ? 'border-indigo-500/50 bg-indigo-500/10 text-white' : 'border-[#2b334a] bg-[#0d1017] text-gray-400 hover:text-white'}`}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  const maps = tourMap.split(',').map((value) => value.trim()).filter(Boolean);
                                  setTourMap((selected ? maps.filter((value) => value !== map) : [...maps, map]).join(', '));
                                }}
                                className="accent-indigo-500"
                              />
                              {map}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                        Status
                      </label>
                      <select
                        value={tourStatus}
                        onChange={(e) => setTourStatus(e.target.value as any)}
                        className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                      Square Card Background Image URL
                    </label>
                    <input
                      type="url"
                      value={tourCardImage}
                      onChange={(e) => setTourCardImage(e.target.value)}
                      placeholder="https://example.com/tournament-art.jpg"
                      className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">Leave blank to use the built-in category artwork.</p>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors"
                  >
                    Save Tournament Changes
                  </button>
                </form>
              )}

              {/* TAB 4: REDIRECT LINK (Requirement 8) */}
              {tab === 'redirect' && (
                <form onSubmit={handleSaveRedirect} className="space-y-4 max-w-xl">
                  {saveRedirectSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                      <Check size={16} /> Redirect link updated successfully!
                    </div>
                  )}

                  <div className="bg-[#151926] p-4 rounded-xl border border-[#242b3e]">
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Link size={14} /> Registration Redirect Link Feature
                    </div>
                    <p className="text-xs text-gray-400">
                      After successful team registration, a button will display on the confirmation screen (e.g. to invite teams to the official WhatsApp or Discord room).
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="enableRedirect"
                      checked={redirectEnabled}
                      onChange={(e) => setRedirectEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-[#0d1017] border-[#2b334a]"
                    />
                    <label htmlFor="enableRedirect" className="text-xs font-medium text-white cursor-pointer">
                      Enable Redirect Button after registration confirmation
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                      Destination URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://discord.gg/your-scrims or https://chat.whatsapp.com/..."
                      value={redirectLink}
                      onChange={(e) => setRedirectLink(e.target.value)}
                      className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                      Button Label
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Join Official Discord Lounge"
                      value={redirectBtnText}
                      onChange={(e) => setRedirectBtnText(e.target.value)}
                      className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors"
                    >
                      Save Redirect Settings
                    </button>
                    {redirectLink && (
                      <button
                        type="button"
                        onClick={handleRemoveRedirect}
                        className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-semibold rounded-xl text-xs transition-colors"
                      >
                        Remove Link
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* TAB 5: DISCORD WEBHOOK RELAY (Requirement 6) */}
              {tab === 'discord' && (
                <div className="space-y-4 max-w-xl">
                  <div className="bg-[#151926] p-4 rounded-xl border border-[#242b3e]">
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Send size={14} /> Server-Side Discord Relay
                    </div>
                    <p className="text-xs text-gray-400">
                      Teams registered on the website trigger an instant Discord embed notification with Registration ID, team name, leader UID, and remaining slots. The webhook URL is kept safely on the backend relay server and never exposed to client JavaScript.
                    </p>
                  </div>

                  {discordMasked && (
                    <div className="bg-[#0f121b] border border-[#23283a] p-3 rounded-xl text-xs flex items-center justify-between">
                      <div>
                        <span className="text-gray-400">Current Webhook:</span>{' '}
                        <span className="text-emerald-400 font-mono font-medium">{discordMasked}</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        ACTIVE
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleSaveDiscord} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                        Discord Channel Webhook URL
                      </label>
                      <input
                        type="password"
                        placeholder="https://discord.com/api/webhooks/..."
                        value={discordWebhookUrl}
                        onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                        className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors"
                      >
                        Save Webhook URL
                      </button>
                      <button
                        type="button"
                        onClick={handleTestDiscord}
                        disabled={discordTestLoading}
                        className="px-4 py-2 bg-[#202536] hover:bg-[#282f45] text-indigo-300 font-semibold rounded-xl text-xs transition-colors"
                      >
                        {discordTestLoading ? 'Sending Test...' : 'Send Test Notification'}
                      </button>
                    </div>
                  </form>

                  {discordTestStatus && (
                    <div className="p-3 bg-[#0f121b] border border-[#262c3e] rounded-xl text-xs text-white">
                      {discordTestStatus}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: AUDIT REGISTRATION LOGS */}
              {tab === 'logs' && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-400">
                    Live registration events and Discord notification delivery history:
                  </div>

                  {logs.length === 0 ? (
                    <div className="bg-[#151926] p-8 rounded-xl text-center text-gray-400 text-xs">
                      No registration logs recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-[#151926] border border-[#242b3e] p-3 rounded-xl text-xs flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-indigo-400 font-bold">{log.registrationId}</span>
                              <span className="font-bold text-white">{log.teamName}</span>
                              <span className="text-gray-400">({log.tournamentName})</span>
                            </div>
                            <div className="text-gray-400 mt-0.5">
                              Leader: {log.leaderName} • Registered: {log.registeredCount} teams • Remaining:{' '}
                              {log.remainingSlots} slots
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              DISPATCHED
                            </span>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Tournament Sub-Modal */}
        {showCreateTour && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#161a25] border border-[#2b334a] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto text-white">
              <div className="flex items-center justify-between pb-3 border-b border-[#212638] mb-4">
                <h3 className="font-bold text-base">Create New Free Fire Scrim</h3>
                <button
                  onClick={() => setShowCreateTour(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateTournament} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tournament Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OG x o7 Squad Clash #4"
                    value={newTourName}
                    onChange={(e) => setNewTourName(e.target.value)}
                    className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Date</label>
                    <input
                      type="text"
                      placeholder="e.g. Nov 14, 2026"
                      value={newTourDate}
                      onChange={(e) => setNewTourDate(e.target.value)}
                      className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Time</label>
                    <input
                      type="text"
                      placeholder="18:00 UTC"
                      value={newTourTime}
                      onChange={(e) => setNewTourTime(e.target.value)}
                      className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Max Teams</label>
                    <input
                      type="number"
                      min="1"
                      max="48"
                      value={newTourMax}
                      onChange={(e) => setNewTourMax(Number(e.target.value))}
                      className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-2">Select Maps</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {MAP_OPTIONS.map((map) => (
                        <label key={map} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${newTourMap.includes(map) ? 'border-indigo-500/50 bg-indigo-500/10 text-white' : 'border-[#2b334a] bg-[#0d1017] text-gray-400 hover:text-white'}`}>
                          <input
                            type="checkbox"
                            checked={newTourMap.includes(map)}
                            onChange={() => setNewTourMap((maps) => maps.includes(map) ? maps.filter((value) => value !== map) : [...maps, map])}
                            className="accent-indigo-500"
                          />
                          {map}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category *</label>
                  <select
                    value={newTourCategory}
                    onChange={(e) => setNewTourCategory(e.target.value as any)}
                    className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="practice">Practice Tournament</option>
                    <option value="free">Free Tournament</option>
                    <option value="paid">Paid Scrims</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">CG Group Invite Link</label>
                  <input
                    type="url"
                    placeholder="https://discord.gg/..."
                    value={newTourGroupLink}
                    onChange={(e) => setNewTourGroupLink(e.target.value)}
                    className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">This link powers the Join Official Discord Lounge button after registration.</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Square Card Background Image URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/tournament-art.jpg"
                    value={newTourCardImage}
                    onChange={(e) => setNewTourCardImage(e.target.value)}
                    className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Optional. Leave blank to use the default tournament artwork.</p>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateTour(false)}
                    className="px-3 py-1.5 bg-[#202536] text-gray-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs"
                  >
                    Create Scrim
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Team Sub-Modal */}
        {editingTeam && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#161a25] border border-[#2b334a] rounded-2xl p-6 w-full max-w-md text-white">
              <div className="flex items-center justify-between pb-3 border-b border-[#212638] mb-4">
                <h3 className="font-bold text-base">Edit Team Details</h3>
                <button
                  onClick={() => setEditingTeam(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleEditTeamSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Team Name</label>
                  <input
                    type="text"
                    required
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                    className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Team Leader Name</label>
                  <input
                    type="text"
                    required
                    value={editLeaderName}
                    onChange={(e) => setEditLeaderName(e.target.value)}
                    className="w-full bg-[#0d1017] border border-[#2b334a] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingTeam(null)}
                    className="px-3 py-1.5 bg-[#202536] text-gray-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showAdminRegistration && currentTour.id && (
          <RegistrationModal
            tournament={currentTour}
            onClose={() => setShowAdminRegistration(false)}
            onSuccess={(team) => {
              setShowAdminRegistration(false);
              alert(`Team registered successfully. Official Registration ID: ${team.registrationId}`);
            }}
          />
        )}
      </div>
    </div>
  );
};
