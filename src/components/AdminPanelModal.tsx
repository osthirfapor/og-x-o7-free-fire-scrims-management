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
  Copy,
  Ban,
  LayoutDashboard,
  History as HistoryIcon,
  CalendarDays,
  MoreVertical,
  Gamepad2,
  Wallet,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sendDiscordEvent } from '../lib/discordEvents';
import { Tournament, Team, TeamAccount, TeamWallet, RegistrationLog, AdminActivityLog, Player, MatchResult } from '../types/tournament';
import { RegistrationModal } from './RegistrationModal';
import {
  createTournament,
  updateTournament,
  deleteTournament,
  updateTeam,
  deleteTeam,
  subscribeRegistrationLogs,
  subscribeAdminActivityLogs,
  writeAdminActivityLog,
  subscribeMatchResults,
  addMatchResult,
  deleteMatchResult,
  setTeamBanned,
  calcPoints,
  buildLeaderboard,
  publishTournamentResults,
  subscribeTeamAccounts,
  creditTeamWallet,
  subscribeTeamWallets,
  subscribeTeams,
} from '../services/tournamentService';

interface Props {
  tournaments: Tournament[];
  teams: Team[];
  activeTournament: Tournament;
  onSelectTournament: (t: Tournament) => void;
  onClose: () => void;
  standalone?: boolean;
}

const MAP_OPTIONS = ['Purgatory', 'Alpine', 'NexTerra'];
const DEFAULT_MAP = MAP_OPTIONS[0];
const cleanMapSelection = (value?: string) => {
  const valid = (value || '').split(',').map((item) => item.trim()).filter((item) => MAP_OPTIONS.includes(item));
  return valid.length ? valid.join(', ') : DEFAULT_MAP;
};

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
  const [tab, setTab] = useState<'overview' | 'scrims' | 'wallets' | 'teams' | 'results' | 'history' | 'tournament' | 'redirect' | 'discord' | 'logs'>('overview');

  // Selected Tournament for Admin Action
  const [currentTour, setCurrentTour] = useState<Tournament>(activeTournament);

  // Tournament Editing State
  const [tourName, setTourName] = useState(currentTour.name);
  const [tourDate, setTourDate] = useState(currentTour.date);
  const [tourTime, setTourTime] = useState(currentTour.time);
  const [tourMaxTeams, setTourMaxTeams] = useState(currentTour.maxTeams);
  const [tourEntryFee, setTourEntryFee] = useState(currentTour.entryFee || '');
  const [tourStatus, setTourStatus] = useState(currentTour.status);
  const [tourMap, setTourMap] = useState(cleanMapSelection(currentTour.map));
  const [tourCardImage, setTourCardImage] = useState(currentTour.cardImageUrl || '');
  const [saveTourSuccess, setSaveTourSuccess] = useState(false);

  // Redirect Link State
  const [redirectLink, setRedirectLink] = useState(currentTour.redirectLink || '');
  const [redirectEnabled, setRedirectEnabled] = useState(currentTour.redirectLinkEnabled ?? true);
  const [redirectBtnText, setRedirectBtnText] = useState(currentTour.redirectButtonText || 'Join Scrims Group');
  const [saveRedirectSuccess, setSaveRedirectSuccess] = useState(false);

  // New Tournament Modal State
  const [showCreateTour, setShowCreateTour] = useState(false);
  const [openScrimMenu, setOpenScrimMenu] = useState<string | null>(null);
  const [openOverviewMenu, setOpenOverviewMenu] = useState(false);
  const [openOverviewTourMenu, setOpenOverviewTourMenu] = useState<string | null>(null);
  const [newlyCreatedRegistrationLink, setNewlyCreatedRegistrationLink] = useState('');
  const [copiedRegistrationLink, setCopiedRegistrationLink] = useState<string | null>(null);
  const [newTourName, setNewTourName] = useState('');
  const [newTourDate, setNewTourDate] = useState('');
  const [newTourTime, setNewTourTime] = useState('18:00 UTC');
  const [newTourMax, setNewTourMax] = useState(12);
  const [newTourMap, setNewTourMap] = useState<string[]>([DEFAULT_MAP]);
  const [newTourCategory, setNewTourCategory] = useState<'practice' | 'free' | 'paid'>('practice');
  const [newTourEntryFee, setNewTourEntryFee] = useState('');
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
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);
  const [showAdminRegistration, setShowAdminRegistration] = useState(false);
  const [teamAccounts, setTeamAccounts] = useState<TeamAccount[]>([]);
  const [allRegisteredTeams, setAllRegisteredTeams] = useState<Team[]>([]);
  const [walletTeamSearch, setWalletTeamSearch] = useState('');
  const [teamWallets, setTeamWallets] = useState<TeamWallet[]>([]);
  const [walletSearch, setWalletSearch] = useState('');
  const [walletTeamName, setWalletTeamName] = useState('');
  const [walletCreditAmount, setWalletCreditAmount] = useState('');
  const [walletCreditMessage, setWalletCreditMessage] = useState<string | null>(null);
  const allTournamentIds = tournaments.map((tournament) => tournament.id).sort().join('|');

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
    setTourEntryFee(activeTournament.entryFee || '');
    setTourStatus(activeTournament.status);
    setTourMap(cleanMapSelection(activeTournament.map));
    setTourCardImage(activeTournament.cardImageUrl || '');
    setRedirectLink(activeTournament.redirectLink || '');
    setRedirectEnabled(activeTournament.redirectLinkEnabled ?? true);
    setRedirectBtnText(activeTournament.redirectButtonText || 'Join Scrims Group');
  }, [activeTournament]);

  // Load privileged data only after Firebase confirms this user is an admin.
  useEffect(() => {
    if (!isAdmin) {
      setLogs([]);
      setActivityLogs([]);
      setTeamAccounts([]);
      setTeamWallets([]);
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
    const unsubActivity = subscribeAdminActivityLogs((items) => setActivityLogs(items));
    const unsubAccounts = subscribeTeamAccounts((items) => setTeamAccounts(items));
    const unsubWallets = subscribeTeamWallets((items) => setTeamWallets(items));
    const unsubResults = subscribeMatchResults((r) => setResults(r));
    return () => {
      unsubLogs();
      unsubActivity();
      unsubAccounts();
      unsubWallets();
      unsubResults();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !allTournamentIds) {
      setAllRegisteredTeams([]);
      return;
    }
    const ids = allTournamentIds.split('|');
    setAllRegisteredTeams([]);
    const unsubscribers = ids.map((tournamentId) => subscribeTeams(tournamentId, (items) => {
      setAllRegisteredTeams((previous) => [
        ...previous.filter((team) => team.tournamentId !== tournamentId),
        ...items,
      ]);
    }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [isAdmin, allTournamentIds]);

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

  const recordAdminActivity = (eventType: string, summary: string, teamName?: string) => {
    void writeAdminActivityLog({ eventType, summary, tournamentId: currentTour.id || undefined, tournamentName: currentTour.name, teamName })
      .catch((error) => console.warn('Could not save admin activity log:', error));
  };

  // Switch tournament
  const handleSelectTournament = (tour: Tournament) => {
    setCurrentTour(tour);
    onSelectTournament(tour);
    setTourName(tour.name);
    setTourDate(tour.date);
    setTourTime(tour.time);
    setTourMaxTeams(tour.maxTeams);
    setTourEntryFee(tour.entryFee || '');
    setTourStatus(tour.status);
    setTourMap(cleanMapSelection(tour.map));
    setTourCardImage(tour.cardImageUrl || '');
    setRedirectLink(tour.redirectLink || '');
    setRedirectEnabled(tour.redirectLinkEnabled ?? true);
    setRedirectBtnText(tour.redirectButtonText || 'Join Scrims Group');
  };

  const buildRegistrationLink = (tournamentId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('panel');
    url.searchParams.set('register', tournamentId);
    url.hash = '';
    return `${url.origin}${url.pathname}${url.search}`;
  };

  const copyRegistrationLink = async (tournamentId: string) => {
    const link = buildRegistrationLink(tournamentId);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedRegistrationLink(tournamentId);
      window.setTimeout(() => setCopiedRegistrationLink(null), 2200);
    } catch {
      window.prompt('Copy registration link:', link);
    }
  };

  // Toggle registration directly from the Scrims list.
  const handleToggleRegistration = async (tour: Tournament) => {
    const nextStatus = tour.status === 'open' ? 'closed' : 'open';
    try {
      await updateTournament(tour.id, { status: nextStatus });
      if (currentTour.id === tour.id) setTourStatus(nextStatus);
      void writeAdminActivityLog({ eventType: nextStatus === 'open' ? 'registration_opened' : 'registration_closed', summary: `Registration ${nextStatus} for ${tour.name}.`, tournamentId: tour.id, tournamentName: tour.name }).catch((error) => console.warn('Could not save admin activity log:', error));
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
        entryFee: currentTour.category === 'paid' ? tourEntryFee.trim() : '',
        entryFeeAmount: currentTour.category === 'paid' ? Number(tourEntryFee) || 0 : 0,
        status: tourStatus,
        map: tourMap,
        cardImageUrl: tourCardImage.trim(),
      });
      recordAdminActivity('tournament_updated', `Updated tournament settings for ${tourName}.`);
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
      recordAdminActivity('group_link_updated', `Updated CG group link for ${currentTour.name}.`);
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
      recordAdminActivity('group_link_removed', `Removed CG group link for ${currentTour.name}.`);
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
        entryFee: newTourCategory === 'paid' ? newTourEntryFee.trim() : '',
        entryFeeAmount: newTourCategory === 'paid' ? Number(newTourEntryFee) || 0 : 0,
        date: newTourDate || new Date().toISOString().split('T')[0],
        time: newTourTime || '18:00 UTC',
        maxTeams: Number(newTourMax) || 12,
        map: newTourMap.join(', ') || DEFAULT_MAP,
        redirectLink: newTourGroupLink.trim(),
        redirectLinkEnabled: Boolean(newTourGroupLink.trim()),
        redirectButtonText: 'Join Official Discord Lounge',
        cardImageUrl: newTourCardImage.trim(),
      });
      void writeAdminActivityLog({ eventType: 'tournament_created', summary: `Created ${newTourCategory} tournament: ${newTourName.trim()}.`, tournamentId: newId, tournamentName: newTourName.trim() }).catch((error) => console.warn('Could not save admin activity log:', error));
      setNewlyCreatedRegistrationLink(buildRegistrationLink(newId));
      setTab('overview');
      setShowCreateTour(false);
      setNewTourName('');
      setNewTourEntryFee('');
      setNewTourGroupLink('');
      setNewTourCardImage('');
      setNewTourMap([DEFAULT_MAP]);
      alert('New tournament scrim successfully created!');
    } catch (err: any) {
      alert(`Failed to create tournament: ${err.message}`);
    }
  };

  // Delete Tournament
  const handleDeleteTournament = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this tournament and its registrations?')) {
      try {
        const removedTournament = tournaments.find((item) => item.id === id);
        await deleteTournament(id);
        void sendDiscordEvent('tournament_deleted', {
          'Tournament': removedTournament?.name || id,
          'Tournament ID': id,
          'Registered teams': removedTournament?.registeredCount ?? 'unknown',
        });
        void writeAdminActivityLog({ eventType: 'tournament_deleted', summary: `Deleted tournament ${tournaments.find((item) => item.id === id)?.name || id}.`, tournamentId: id, tournamentName: tournaments.find((item) => item.id === id)?.name }).catch((error) => console.warn('Could not save admin activity log:', error));
      } catch (err: any) {
        alert(`Failed to delete tournament: ${err.message}`);
      }
    }
  };

  const handleCompleteTournament = async (tour: Tournament) => {
    if (!confirm(`Complete ${tour.name}? Draft results will be published and moved to Match History.`)) return;
    try {
      const publishedCount = await publishTournamentResults(tour.id);
      await updateTournament(tour.id, { status: 'completed' });
      if (currentTour.id === tour.id) setTourStatus('completed');
      void writeAdminActivityLog({ eventType: 'tournament_completed', summary: `Completed ${tour.name}; published ${publishedCount} draft result(s).`, tournamentId: tour.id, tournamentName: tour.name }).catch((error) => console.warn('Could not save admin activity log:', error));
      setOpenScrimMenu(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not complete tournament.');
    }
  };

  // Team Actions: Approve / Reject
  const handleTeamStatus = async (team: Team, nextStatus: 'approved' | 'rejected' | 'pending' | 'banned') => {
    try {
      if (nextStatus === 'banned') await setTeamBanned(team.teamName, true);
      if (team.status === 'banned' && nextStatus !== 'banned') await setTeamBanned(team.teamName, false);
      await updateTeam(team.tournamentId, team.id, { status: nextStatus });
      recordAdminActivity(team.status === 'banned' && nextStatus !== 'banned' ? 'team_unbanned' : nextStatus === 'banned' ? 'team_banned' : nextStatus === 'approved' ? 'team_approved' : 'team_rejected', `${team.teamName} was ${team.status === 'banned' && nextStatus !== 'banned' ? 'unbanned' : nextStatus}.`, team.teamName);
    } catch (err: any) {
      if (nextStatus === 'banned') await setTeamBanned(team.teamName, false).catch(() => undefined);
      alert(`Failed to update team: ${err.message}`);
    }
  };

  const handleWalletCredit = async (event: React.FormEvent) => {
    event.preventDefault();
    setWalletCreditMessage(null);
    try {
      const wallet = await creditTeamWallet(walletTeamName, Number(walletCreditAmount));
      void sendDiscordEvent('wallet_credited', {
        'Team name': wallet.teamName,
        'Amount added': `৳${Number(walletCreditAmount).toLocaleString()}`,
        'New balance': `৳${wallet.balance.toLocaleString()}`,
      });
      recordAdminActivity('wallet_credited', `Added ৳${Number(walletCreditAmount).toLocaleString()} to ${wallet.teamName}'s wallet.`, wallet.teamName);
      setWalletCreditMessage(`৳${Number(walletCreditAmount).toLocaleString()} added. ${wallet.teamName}'s balance is now ৳${wallet.balance.toLocaleString()}.`);
      setWalletCreditAmount('');
    } catch (error) {
      setWalletCreditMessage(error instanceof Error ? error.message : 'Could not credit this wallet.');
    }
  };

  // Team Actions: Delete
  const handleDeleteTeam = async (team: Team) => {
    if (confirm(`Remove team "${team.teamName}"? This will decrement registered count and open a slot.`)) {
      try {
        await deleteTeam(team.tournamentId, team.id);
        recordAdminActivity('team_removed', `Removed team ${team.teamName} from ${currentTour.name}.`, team.teamName);
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
      recordAdminActivity('team_updated', `Updated team details for ${editTeamName.trim()}.`, editTeamName.trim());
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
        recordAdminActivity('discord_webhook_updated', `Updated Discord webhook settings for ${currentTour.name}.`);
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
        recordAdminActivity('discord_test_sent', `Discord webhook test succeeded for ${currentTour.name}.`);
      } else {
        setDiscordTestStatus(`❌ Discord error: ${data.error}`);
        recordAdminActivity('discord_test_failed', `Discord webhook test failed for ${currentTour.name}.`);
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
      recordAdminActivity('match_result_added', `Saved rank #${resPosition} for ${resTeam}.`, resTeam);
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
        recordAdminActivity('match_result_removed', `Removed match result for ${r.teamName} (rank #${r.position}).`, r.teamName);
      } catch (err: any) {
        alert(`Failed to delete result: ${err.message}`);
      }
    }
  };

  const handlePublishResults = async () => {
    if (!draftTourResults.length) return;
    if (!confirm(`Publish ${draftTourResults.length} result(s) for ${currentTour.name} to the public leaderboard and match history?`)) return;
    try {
      const publishedCount = await publishTournamentResults(currentTour.id);
      recordAdminActivity('match_results_published', `Published ${publishedCount} result(s) for ${currentTour.name}.`);
      setResMsg(`✅ ${publishedCount} result(s) published to Match History.`);
      window.setTimeout(() => setResMsg(null), 3000);
    } catch (err) {
      setResMsg(`❌ ${err instanceof Error ? err.message : 'Could not publish results.'}`);
    }
  };

  const tourResults = results
    .filter((r) => r.tournamentId === currentTour.id)
    .sort((a, b) => a.position - b.position || b.kills - a.kills);
  const draftTourResults = tourResults.filter((result) => result.published === false);
  const publishedTourResults = results
    .filter((result) => result.published !== false)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const overallBoard = buildLeaderboard(results);

  // Filter teams for current tournament
  const currentTourTeams = teams.filter((t) => t.tournamentId === currentTour.id);
  const activeScrims = tournaments.filter((tournament) => tournament.status !== 'completed');
  const tournamentsWithSlots = activeScrims;
  const completedScrims = tournaments.filter((tournament) => tournament.status === 'completed').sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  const visibleWallets = teamWallets.filter((wallet) => wallet.teamName.toLocaleLowerCase().includes(walletSearch.toLocaleLowerCase().trim()));
  const registeredWalletTeamNames = Array.from(new Set([
    ...teamAccounts.filter((account) => account.status === 'approved' || account.status === 'pending').map((account) => account.teamName.trim()),
    ...allRegisteredTeams.filter((team) => team.status === 'approved').map((team) => team.teamName.trim()),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const searchedWalletTeamNames = registeredWalletTeamNames.filter((name) => name.toLocaleLowerCase().includes(walletTeamSearch.toLocaleLowerCase().trim()));
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
    <div className={standalone ? 'fixed inset-0 z-50 h-screen w-screen overflow-auto bg-[#09090d] animate-fade-in' : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fade-in'}>
      <div className={`relative w-full ${standalone ? 'min-h-screen max-w-none rounded-none border-0 shadow-none' : 'max-w-5xl max-h-[92vh] mx-auto rounded-2xl border border-[#282934] shadow-2xl'} bg-[#121319] p-5 sm:p-7 text-white flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#23242e]">
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white bg-[#1c1d26] rounded-lg hover:bg-[#25262f] transition-colors"
                title="Log out of admin session"
              >
                <LogOut size={14} /> Log out
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#22232c] transition-colors"
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
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 shadow-[0_0_25px_rgba(255,95,26,0.25)]">
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
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Admin username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-4 py-2.5 text-sm text-center text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                />
              </div>
              <div>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-4 py-2.5 text-sm text-center text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
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
            <div className="admin-workspace flex min-h-0 flex-1 gap-4">
              <aside className="admin-sidebar flex w-52 shrink-0 flex-col gap-1 border-r border-[#23242e] pr-3">
                {[
                  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                  { id: 'scrims', label: `Scrims (${activeScrims.length})`, icon: CalendarDays },
                  { id: 'wallets', label: `Team Wallet (${teamWallets.length})`, icon: Wallet },
                  { id: 'teams', label: `Registered Teams (${currentTourTeams.length})`, icon: Users },
                  { id: 'results', label: `Results (${draftTourResults.length})`, icon: Trophy },
                  { id: 'history', label: `Match History (${publishedTourResults.length + completedScrims.length})`, icon: HistoryIcon },
                  { id: 'logs', label: `Activity Logs (${logs.length + activityLogs.length})`, icon: ListFilter },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" title={item.label} onClick={() => setTab(item.id as typeof tab)} className={`admin-side-link flex items-center gap-2.5 rounded-xl px-3 py-3 text-left text-xs font-bold transition-all ${tab === item.id ? 'is-active' : 'text-slate-400 hover:bg-white/[.04] hover:text-white'}`}>
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </aside>

              {/* TAB CONTENT */}
              <div key={tab} className="admin-tab-panel min-h-0 flex-1 overflow-y-auto pr-1">
              {tab === 'scrims' && (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-200">Tournament control</div>
                      <h3 className="mt-1 text-lg font-extrabold text-white">Scrims</h3>
                      <p className="mt-1 text-xs text-slate-400">Select a scrim to manage teams, results, and settings.</p>
                    </div>
                    <button type="button" onClick={() => setShowCreateTour(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-orange-950/25 transition hover:-translate-y-0.5 hover:brightness-110">
                      <Plus size={15} /> New Scrim
                    </button>
                  </div>
                  {activeScrims.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No active scrims. Create a new scrim or view completed tournaments in Match History.</div> : (
                    <div className="space-y-2.5">
                      {activeScrims.map((tour) => {
                        const selected = tour.id === currentTour.id;
                        const full = tour.registeredCount >= tour.maxTeams;
                        return (
                          <article key={tour.id} className={`rounded-2xl border p-4 transition-all ${selected ? 'border-orange-300/35 bg-orange-300/[.045] shadow-lg shadow-orange-950/10' : 'border-[#282934] bg-[#15161d] hover:border-white/15'}`}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="truncate text-sm font-bold text-white">{tour.name}</h4>
                                  {selected && <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-2 py-0.5 text-[9px] font-bold uppercase text-orange-200">Selected</span>}
                                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${full ? 'border-rose-300/20 bg-rose-300/10 text-rose-200' : tour.status === 'open' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-white/[.04] text-slate-400'}`}>{full ? 'Full' : tour.status}</span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                  <span>{tour.date} · {tour.time}</span><span>{tour.registeredCount}/{tour.maxTeams} teams</span>
                                  {tour.category === 'paid' && tour.entryFee && <span className="font-bold text-amber-200">৳{Number(tour.entryFee).toLocaleString()} / team</span>}
                                </div>
                              </div>
                              <div className="relative shrink-0">
                                <button type="button" aria-label={`Actions for ${tour.name}`} aria-expanded={openScrimMenu === tour.id} onClick={() => setOpenScrimMenu((open) => open === tour.id ? null : tour.id)} className="rounded-xl border border-white/10 bg-white/[.04] p-2.5 text-slate-300 transition hover:border-orange-300/25 hover:bg-orange-300/[.07] hover:text-white"><MoreVertical size={17} /></button>
                                {openScrimMenu === tour.id && <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#191a22] p-1.5 shadow-2xl">
                                  <button type="button" onClick={() => { handleSelectTournament(tour); setTab('teams'); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/[.06]">Manage teams</button>
                                  <button type="button" onClick={() => { handleSelectTournament(tour); setTab('tournament'); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Edit tournament info</button>
                                  <button type="button" onClick={() => { handleSelectTournament(tour); setTab('redirect'); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Edit CG Group link</button>
                                  <button type="button" onClick={() => { handleSelectTournament(tour); setTab('discord'); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Server-side Discord relay</button>
                                  <button type="button" disabled={full && tour.status !== 'open'} onClick={() => { void handleToggleRegistration(tour); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06] disabled:opacity-40">{tour.status === 'open' ? 'Close registration' : 'Open registration'}</button>
                                  <button type="button" onClick={() => { void copyRegistrationLink(tour.id); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-indigo-200 hover:bg-indigo-300/[.08]">{copiedRegistrationLink === tour.id ? 'Link copied' : 'Copy registration link'}</button>
                                  <button type="button" onClick={() => void handleCompleteTournament(tour)} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-emerald-200 hover:bg-emerald-300/[.08]">Complete tournament</button>
                                  <div className="my-1 border-t border-white/[.07]" />
                                  <button type="button" onClick={() => { setOpenScrimMenu(null); void handleDeleteTournament(tour.id); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-rose-200 hover:bg-rose-300/[.08]">Delete tournament</button>
                                </div>}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {tab === 'wallets' && (
                <section className="space-y-4">
                  <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-200">Team balances</div><h3 className="mt-1 text-lg font-extrabold text-white">Team Wallet</h3><p className="mt-1 text-xs text-slate-400">Credit a squad by team name. Paid tournament registration checks and deducts this balance automatically.</p></div>
                  <div className="space-y-2 rounded-2xl border border-white/[.07] bg-[#101117] p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Registered teams ({registeredWalletTeamNames.length})</h4><div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={walletTeamSearch} onChange={(event) => setWalletTeamSearch(event.target.value)} placeholder="Search team name" className="w-full rounded-lg border border-white/10 bg-[#0b0c10] py-2 pl-8 pr-3 text-[11px] text-white outline-none focus:border-amber-300/30 sm:w-60"/></div></div><div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">{searchedWalletTeamNames.map((name) => <button type="button" key={name} onClick={() => { setWalletTeamName(name); setWalletCreditMessage(null); }} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${walletTeamName === name ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-white/[.07] bg-white/[.025] text-slate-300 hover:border-white/15 hover:text-white'}`}>{name}</button>)}{!searchedWalletTeamNames.length && <span className="py-2 text-[10px] text-slate-500">{registeredWalletTeamNames.length ? 'No team name matches your search.' : 'No registered teams found yet.'}</span>}</div></div>
                  <form onSubmit={handleWalletCredit} className="grid gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.035] p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                    <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected team</span><input required readOnly value={walletTeamName} placeholder="Select a registered team above" className="w-full rounded-xl border border-white/10 bg-[#0b0c10] px-3.5 py-2.5 text-sm text-white outline-none read-only:cursor-not-allowed read-only:text-amber-100 focus:border-amber-300/40"/></label>
                    <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Add amount (৳)</span><input required type="number" min="0.01" step="0.01" value={walletCreditAmount} onChange={(event) => setWalletCreditAmount(event.target.value)} placeholder="e.g. 500" className="w-full rounded-xl border border-white/10 bg-[#0b0c10] px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-300/40"/></label>
                    <button type="submit" disabled={!walletTeamName} className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-xs font-extrabold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"><Plus size={14} className="mr-1 inline"/>Add money</button>
                    {walletCreditMessage && <div role="status" className="sm:col-span-3 rounded-lg border border-white/[.08] bg-black/20 px-3 py-2 text-xs text-amber-100">{walletCreditMessage}</div>}
                  </form>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Current balances</h4><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={walletSearch} onChange={(event) => setWalletSearch(event.target.value)} placeholder="Search team name" className="w-full rounded-xl border border-white/10 bg-[#0b0c10] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-amber-300/30 sm:w-64"/></div></div>
                  {visibleWallets.length ? <div className="space-y-2">{visibleWallets.map((wallet) => <article key={wallet.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#282934] bg-[#15161d] px-4 py-3"><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{wallet.teamName}</div><div className="mt-1 text-[10px] text-slate-500">Updated {new Date(wallet.updatedAt).toLocaleString()}</div></div><div className="shrink-0 text-right text-lg font-black tabular-nums text-amber-200">৳{Number(wallet.balance || 0).toLocaleString()}</div></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">No wallet balances yet. Add funds by entering a squad name above.</div>}
                </section>
              )}

              {/* TAB 1: OVERVIEW */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-200">Organizer workspace</div><h3 className="mt-1 text-lg font-extrabold text-white">Overview</h3></div><div className="relative"><button type="button" aria-label="Overview settings" aria-expanded={openOverviewMenu} onClick={() => setOpenOverviewMenu((open) => !open)} className="rounded-xl border border-white/10 bg-white/[.04] p-2.5 text-slate-300 transition hover:border-orange-300/25 hover:text-white"><MoreVertical size={17} /></button>{openOverviewMenu && <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-white/10 bg-[#191a22] p-1.5 shadow-2xl"><button type="button" onClick={() => { setTab('tournament'); setOpenOverviewMenu(false); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/[.06]">Edit tournament info</button><button type="button" onClick={() => { setTab('redirect'); setOpenOverviewMenu(false); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">CG Group link</button><button type="button" onClick={() => { setTab('discord'); setOpenOverviewMenu(false); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Server-side Discord relay</button></div>}</div></div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]">
                      <div className="text-xs text-gray-400">Total Scrims</div>
                      <div className="text-2xl font-bold text-white mt-1">{tournaments.length}</div>
                    </div>
                    <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]">
                      <div className="text-xs text-gray-400">Registered Teams</div>
                      <div className="text-2xl font-bold text-indigo-400 mt-1">{currentTourTeams.length}</div>
                    </div>
                    <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]">
                      <div className="text-xs text-gray-400">Remaining Slots</div>
                      <div className="text-2xl font-bold text-emerald-400 mt-1">
                        {Math.max(0, currentTour.maxTeams - currentTour.registeredCount)}
                      </div>
                    </div>
                    <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]">
                      <div className="text-xs text-gray-400">Total Players</div>
                      <div className="text-2xl font-bold text-purple-400 mt-1">
                        {currentTourTeams.length * 5} / {currentTour.maxTeams * 5}
                      </div>
                    </div>
                  </div>

                  {newlyCreatedRegistrationLink && (
                    <div className="flex flex-col gap-2 rounded-xl border border-indigo-400/20 bg-indigo-500/[.07] p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Tournament registration link</div>
                        <div className="mt-1 truncate font-mono text-[11px] text-slate-300">{newlyCreatedRegistrationLink}</div>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard.writeText(newlyCreatedRegistrationLink).then(() => setCopiedRegistrationLink('new')).catch(() => window.prompt('Copy registration link:', newlyCreatedRegistrationLink))} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-500/20 px-3 py-2 text-[11px] font-bold text-indigo-100 transition hover:bg-indigo-500/30">
                        {copiedRegistrationLink === 'new' ? <Check size={13} /> : <Copy size={13} />}
                        {copiedRegistrationLink === 'new' ? 'Copied' : 'Copy link'}
                      </button>
                    </div>
                  )}

                  {/* Scrims List in Overview */}
                  <div className="bg-[#15161d] border border-[#272833] rounded-xl p-4">
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

                    <div className="divide-y divide-[#22232c]">
                      {tournamentsWithSlots.map((t) => (
                        <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="font-bold text-white text-sm">{t.name}</div>
                            <div className="text-gray-400 mt-0.5">
                              {t.date} • {t.time}
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
                            <div className="relative"><button type="button" aria-label={`Actions for ${t.name}`} aria-expanded={openOverviewTourMenu === t.id} onClick={() => setOpenOverviewTourMenu((open) => open === t.id ? null : t.id)} className="rounded-lg border border-white/10 bg-white/[.04] p-2 text-slate-300 hover:text-white"><MoreVertical size={15} /></button>{openOverviewTourMenu === t.id && <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-white/10 bg-[#191a22] p-1.5 shadow-2xl"><button type="button" onClick={() => { handleSelectTournament(t); setTab('teams'); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/[.06]">Manage teams</button><button type="button" onClick={() => { handleSelectTournament(t); setTab('tournament'); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Edit tournament info</button><button type="button" onClick={() => { handleSelectTournament(t); setTab('redirect'); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Edit CG Group link</button><button type="button" onClick={() => { void copyRegistrationLink(t.id); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-indigo-200 hover:bg-indigo-300/[.08]">{copiedRegistrationLink === t.id ? 'Link copied' : 'Copy registration link'}</button><button type="button" onClick={() => { void handleToggleRegistration(t); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">{t.status === 'open' ? 'Close registration' : 'Open registration'}</button><div className="my-1 border-t border-white/[.07]"/><button type="button" onClick={() => { setOpenOverviewTourMenu(null); void handleDeleteTournament(t.id); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-rose-200 hover:bg-rose-300/[.08]">Delete tournament</button></div>}</div>
                          </div>
                        </div>
                      ))}
                      {tournamentsWithSlots.length === 0 && (
                        <div className="py-6 text-center text-xs text-gray-500">
                          No tournaments with open slots. Full tournaments remain available in the Selected Scrim menu.
                        </div>
                      )}
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
                      className="w-full sm:w-80 bg-[#0b0c10] border border-[#282934] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
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
                    <div className="bg-[#15161d] p-8 rounded-xl text-center text-gray-400 text-xs">
                      No registered teams found for this scrim.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {searchedTeams.map((team, idx) => (
                        <div
                          key={team.id}
                          className="bg-[#15161d] border border-[#272833] p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-indigo-400 bg-[#0d0e13] px-2 py-0.5 rounded border border-[#23242e]">
                                #{idx + 1} • {team.registrationId}
                              </span>
                              <h4 className="text-sm font-bold text-white">{team.teamName}</h4>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                  team.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : team.status === 'rejected' || team.status === 'banned'
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
                            {team.status !== 'rejected' && team.status !== 'banned' && (
                              <button
                                onClick={() => handleTeamStatus(team, 'rejected')}
                                className="px-2.5 py-1 text-xs font-semibold bg-red-600/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-600/30"
                              >
                                Reject
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (team.status === 'banned') void handleTeamStatus(team, 'rejected');
                                else if (confirm(`Ban ${team.teamName}? This blocks the team from future registrations.`)) void handleTeamStatus(team, 'banned');
                              }}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${team.status === 'banned' ? 'border-emerald-500/30 bg-emerald-600/15 text-emerald-300' : 'border-rose-500/30 bg-rose-600/15 text-rose-300 hover:bg-rose-600/25'}`}
                              title={team.status === 'banned' ? 'Unban this team' : 'Ban this team from future registrations'}
                            >
                              <Ban size={13} /> {team.status === 'banned' ? 'Unban' : 'Ban'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingTeam(team);
                                setEditTeamName(team.teamName);
                                setEditLeaderName(team.leaderName);
                              }}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#22232c] rounded-lg"
                              title="Edit Team"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#22232c] rounded-lg"
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
                    <form onSubmit={handleAddResult} className="bg-[#15161d] border border-[#272833] rounded-xl p-4 space-y-3">
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
                          className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                            className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                            className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
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
                          className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex items-center justify-between bg-[#0b0c10] border border-[#25262f] rounded-xl px-3 py-2 text-xs">
                        <span className="text-gray-400">Points (auto)</span>
                        <span className="font-mono font-bold text-indigo-300">{calcPoints(resPosition, resKills)} pts</span>
                      </div>

                      {resMsg && <div className="text-xs text-gray-200 bg-[#0d0e13] border border-[#282934] rounded-lg px-3 py-2">{resMsg}</div>}

                      <button
                        type="submit"
                        disabled={resSaving}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all"
                      >
                        {resSaving ? 'Saving...' : 'Save Result'}
                      </button>
                    </form>

                    <div className="bg-[#15161d] border border-[#272833] rounded-xl p-4">
                      <div className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Overall Wins Ranking</div>
                      {overallBoard.length === 0 ? (
                        <p className="text-xs text-gray-500">Kono result nei.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {overallBoard.slice(0, 10).map((e, i) => (
                            <div key={e.teamName} className="flex items-center justify-between text-xs bg-[#0d0e13] border border-[#20212a] rounded-lg px-3 py-2">
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

                  <div className="xl:col-span-3 bg-[#15161d] border border-[#272833] rounded-xl p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Unpublished Results — {currentTour.name}</div>
                        <span className="text-[11px] text-gray-500">Public leaderboard updates when you publish.</span>
                      </div>
                      <button type="button" disabled={!draftTourResults.length} onClick={() => void handlePublishResults()} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-[11px] font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                        <CheckCircle2 size={13} /> Publish Results ({draftTourResults.length})
                      </button>
                    </div>

                    {draftTourResults.length === 0 ? (
                      <div className="text-center text-xs text-gray-500 py-10">No unpublished results. Add a result or view Match History.</div>
                    ) : (
                      <div className="space-y-2">
                        {draftTourResults.map((r) => (
                          <div
                            key={r.id}
                            className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs ${
                              r.position === 1 ? 'bg-amber-500/5 border-amber-500/30' : 'bg-[#0d0e13] border-[#20212a]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-black shrink-0 ${
                                  r.position === 1 ? 'bg-amber-500/20 text-amber-300' : 'bg-[#1e1f27] text-gray-300'
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
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-[#22232c] rounded-lg shrink-0"
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

              {tab === 'history' && (
                <section className="space-y-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-200">Completed scrims</div>
                    <h3 className="mt-1 text-lg font-extrabold text-white">Match History</h3>
                    <p className="mt-1 text-xs text-slate-400">Completed tournaments and published team placements.</p>
                  </div>
                  {completedScrims.length === 0 && publishedTourResults.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No match history yet. Complete a tournament to archive it here.</div> : (
                    <div className="space-y-4">
                      {completedScrims.map((tour) => {
                        const placements = publishedTourResults.filter((result) => result.tournamentId === tour.id).sort((a, b) => a.position - b.position || b.kills - a.kills);
                        return <article key={tour.id} className="overflow-hidden rounded-2xl border border-[#282934] bg-[#15161d]">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.06] px-4 py-3">
                            <div><h4 className="text-sm font-extrabold text-white">{tour.name}</h4><p className="mt-1 text-[10px] text-slate-500">{tour.date} · {tour.time} · {placements.length} result{placements.length === 1 ? '' : 's'}</p></div>
                            <button type="button" onClick={() => { if (confirm(`Delete ${tour.name} and its registrations/results permanently?`)) void handleDeleteTournament(tour.id); }} className="rounded-lg border border-rose-300/15 px-3 py-2 text-[10px] font-bold text-rose-200 transition hover:bg-rose-300/[.08]">Delete tournament</button>
                          </div>
                          {placements.length ? <div className="divide-y divide-white/[.05]">{placements.map((result) => <div key={result.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><div className="flex min-w-0 items-center gap-3"><span className={`w-8 text-center text-xs font-black ${result.position === 1 ? 'text-amber-200' : 'text-slate-400'}`}>{result.position === 1 ? <Crown size={15} className="mx-auto" /> : `#${result.position}`}</span><span className="truncate text-xs font-bold text-white">{result.teamName}</span></div><div className="flex shrink-0 items-center gap-3 text-[10px] text-slate-400"><span>{result.kills} kills</span><span>{result.points} pts</span>{(result.earnings || 0) > 0 && <span className="font-bold text-emerald-300">৳{Number(result.earnings).toLocaleString()}</span>}</div></div>)}</div> : <div className="px-4 py-5 text-xs text-slate-500">No published placements were recorded for this tournament.</div>}
                        </article>;
                      })}
                      {publishedTourResults.some((result) => !completedScrims.some((tour) => tour.id === result.tournamentId)) && <div className="space-y-2"><div className="px-1 pt-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Published matches</div>{publishedTourResults.filter((result) => !completedScrims.some((tour) => tour.id === result.tournamentId)).map((result) => <article key={result.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#282934] bg-[#15161d] p-3"><div className="flex min-w-0 items-center gap-3"><span className="w-8 text-center text-xs font-black text-slate-300">#{result.position}</span><div className="min-w-0"><div className="truncate text-xs font-bold text-white">{result.teamName}</div><div className="truncate text-[10px] text-slate-500">{result.tournamentName}</div></div></div><div className="shrink-0 text-right text-[10px] text-slate-400">{result.kills} kills · {result.points} pts{(result.earnings || 0) > 0 && <div className="font-bold text-emerald-300">৳{Number(result.earnings).toLocaleString()}</div>}</div></article>)}</div>}
                    </div>
                  )}
                </section>
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
                      className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                        className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                        className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                        className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Maps</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {MAP_OPTIONS.map((map) => {
                          const selected = tourMap.split(',').map((value) => value.trim()).includes(map);
                          return (
                            <label key={map} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${selected ? 'border-indigo-500/50 bg-indigo-500/10 text-white' : 'border-[#2a2b36] bg-[#0b0c10] text-gray-400 hover:text-white'}`}>
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
                        className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  {currentTour.category === 'paid' && (
                    <div className="max-w-xs">
                      <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Entry Fee per Team (BDT)</label>
                      <input type="number" min="1" step="1" value={tourEntryFee} onChange={(event) => setTourEntryFee(event.target.value)} placeholder="e.g. 100" className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white" />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                      Square Card Background Image URL
                    </label>
                    <input
                      type="url"
                      value={tourCardImage}
                      onChange={(e) => setTourCardImage(e.target.value)}
                      placeholder="https://example.com/tournament-art.jpg"
                      className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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

                  <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]">
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
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-[#0b0c10] border-[#2a2b36]"
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
                      className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
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
                      className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                  <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]">
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Send size={14} /> Server-Side Discord Relay
                    </div>
                    <p className="text-xs text-gray-400">
                      Teams registered on the website trigger an instant Discord embed notification with Registration ID, team name, leader UID, and remaining slots. The webhook URL is kept safely on the backend relay server and never exposed to client JavaScript.
                    </p>
                  </div>

                  {discordMasked && (
                    <div className="bg-[#0d0e13] border border-[#25262f] p-3 rounded-xl text-xs flex items-center justify-between">
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
                        className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
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
                        className="px-4 py-2 bg-[#22232c] hover:bg-[#2c2d39] text-indigo-300 font-semibold rounded-xl text-xs transition-colors"
                      >
                        {discordTestLoading ? 'Sending Test...' : 'Send Test Notification'}
                      </button>
                    </div>
                  </form>

                  {discordTestStatus && (
                    <div className="p-3 bg-[#0d0e13] border border-[#282934] rounded-xl text-xs text-white">
                      {discordTestStatus}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: AUDIT REGISTRATION LOGS */}
              {tab === 'logs' && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-400">
                    Team registration, Discord delivery, tournament changes, team moderation, match results, and admin actions:
                  </div>

                  {logs.length === 0 && activityLogs.length === 0 ? (
                    <div className="bg-[#15161d] p-8 rounded-xl text-center text-gray-400 text-xs">
                      No activity recorded yet.
                    </div>
                  ) : (
                    <>
                    <h3 className="pt-2 text-[10px] font-bold uppercase tracking-widest text-indigo-200">Tournament registrations & Discord</h3>
                    {logs.length === 0 ? <div className="rounded-xl border border-white/[.06] p-4 text-xs text-slate-500">No team registrations recorded yet.</div> : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-[#15161d] border border-[#272833] p-3 rounded-xl text-xs flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded border border-indigo-400/15 bg-indigo-400/[.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-200">Team registration</span>
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
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${(log.discordStatus || (log.discordDelivered ? 'delivered' : 'failed')) === 'delivered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : (log.discordStatus === 'pending' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20')}`}>
                              {log.discordStatus === 'pending' ? 'DISCORD PENDING' : log.discordStatus === 'delivered' || (!log.discordStatus && log.discordDelivered) ? 'DISCORD SENT' : 'DISCORD FAILED'}
                            </span>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                    <h3 className="pt-3 text-[10px] font-bold uppercase tracking-widest text-orange-200">Admin activity</h3>
                    {activityLogs.length === 0 ? <div className="rounded-xl border border-white/[.06] p-4 text-xs text-slate-500">No admin actions recorded yet.</div> : (
                      <div className="space-y-2">
                        {activityLogs.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#272833] bg-[#15161d] p-3 text-xs">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded border border-orange-300/15 bg-orange-300/[.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-200">{item.eventType.replaceAll('_', ' ')}</span>
                                {item.teamName && <span className="font-bold text-white">{item.teamName}</span>}
                                {item.tournamentName && <span className="truncate text-slate-400">{item.tournamentName}</span>}
                              </div>
                              <div className="mt-1 text-slate-400">{item.summary}</div>
                            </div>
                            <time className="shrink-0 text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</time>
                          </div>
                        ))}
                      </div>
                    )}
                    </>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {/* Create Tournament Sub-Modal */}
        {showCreateTour && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#17181f] border border-[#2a2b36] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto text-white">
              <div className="flex items-center justify-between pb-3 border-b border-[#23242e] mb-4">
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
                    className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
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
                      className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Time</label>
                    <input
                      type="text"
                      placeholder="18:00 UTC"
                      value={newTourTime}
                      onChange={(e) => setNewTourTime(e.target.value)}
                      className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
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
                      className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-2">Select Maps</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {MAP_OPTIONS.map((map) => (
                        <label key={map} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${newTourMap.includes(map) ? 'border-indigo-500/50 bg-indigo-500/10 text-white' : 'border-[#2a2b36] bg-[#0b0c10] text-gray-400 hover:text-white'}`}>
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
                    className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="practice">Practice Tournament</option>
                    <option value="free">Free Tournament</option>
                    <option value="paid">Paid Scrims</option>
                  </select>
                </div>

                {newTourCategory === 'paid' && (
                  <div className="animate-fade-in">
                    <label className="block text-xs text-gray-400 mb-1">Entry fee per team (BDT) *</label>
                    <input type="number" required min="1" step="1" value={newTourEntryFee} onChange={(event) => setNewTourEntryFee(event.target.value)} placeholder="e.g. 100" className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white" />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-gray-400 mb-1">CG Group Invite Link</label>
                  <input
                    type="url"
                    placeholder="https://discord.gg/..."
                    value={newTourGroupLink}
                    onChange={(e) => setNewTourGroupLink(e.target.value)}
                    className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
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
                    className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Optional. Leave blank to use the default tournament artwork.</p>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateTour(false)}
                    className="px-3 py-1.5 bg-[#22232c] text-gray-300 rounded-lg text-xs"
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
            <div className="bg-[#17181f] border border-[#2a2b36] rounded-2xl p-6 w-full max-w-md text-white">
              <div className="flex items-center justify-between pb-3 border-b border-[#23242e] mb-4">
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
                    className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Team Leader Name</label>
                  <input
                    type="text"
                    required
                    value={editLeaderName}
                    onChange={(e) => setEditLeaderName(e.target.value)}
                    className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingTeam(null)}
                    className="px-3 py-1.5 bg-[#22232c] text-gray-300 rounded-lg text-xs"
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
