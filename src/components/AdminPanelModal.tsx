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
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Eye,
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
  publishTournamentResults,
  subscribeTeamAccounts,
  creditTeamWallet,
  subscribeTeamWallets,
  subscribeTeams,
  subscribeTeamAccountContacts,
  deleteTeamDatabaseRecord,
  removePublicWhatsAppFromTeamRecords,
} from '../services/tournamentService';

interface Props {
  tournaments: Tournament[];
  teams: Team[];
  activeTournament: Tournament;
  onSelectTournament: (t: Tournament) => void;
  onClose: () => void;
  standalone?: boolean;
}

const DEFAULT_GROUP_SIZE = 12;
const STANDINGS_COLOR_THEMES = {
  lime: { label: 'Lime green', accent: '#d9f75e', soft: '#e5f990', row: '#0a5734', text: '#082c1b' },
  cyan: { label: 'Ocean cyan', accent: '#67e8f9', soft: '#a5f3fc', row: '#07536b', text: '#082c1b' },
  orange: { label: 'Fire orange', accent: '#fb923c', soft: '#fdba74', row: '#713b16', text: '#2c1608' },
  violet: { label: 'Royal violet', accent: '#c4b5fd', soft: '#ddd6fe', row: '#48347b', text: '#21133d' },
} as const;

function resultGroupLabel(index: number): string {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return `GROUP-${label}`;
}

async function processTournamentImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG, or WebP image.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Image must be 8 MB or smaller.');
  const source = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 800 / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image could not be processed.');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    let quality = 0.86;
    let imageData = canvas.toDataURL('image/webp', quality);
    while (imageData.length > 300_000 && quality > 0.4) {
      quality -= 0.1;
      imageData = canvas.toDataURL('image/webp', quality);
    }
    if (imageData.length > 300_000) throw new Error('Image is too detailed. Choose a smaller image.');
    return imageData;
  } finally {
    source.close();
  }
}

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
  const [tab, setTab] = useState<'overview' | 'scrims' | 'squads' | 'database' | 'wallets' | 'results' | 'history' | 'tournament' | 'redirect' | 'discord' | 'logs'>('overview');
  const [databaseTeamSearch, setDatabaseTeamSearch] = useState('');
  const [expandedDatabaseTeam, setExpandedDatabaseTeam] = useState<string | null>(null);
  const [openDatabaseLoginMenu, setOpenDatabaseLoginMenu] = useState<string | null>(null);
  const [copiedDatabaseLogin, setCopiedDatabaseLogin] = useState<string | null>(null);
  const [copiedDatabasePhone, setCopiedDatabasePhone] = useState<string | null>(null);

  // Selected Tournament for Admin Action
  const [currentTour, setCurrentTour] = useState<Tournament>(activeTournament);

  // Tournament Editing State
  const [tourName, setTourName] = useState(currentTour.name);
  const [tourDate, setTourDate] = useState(currentTour.date);
  const [tourTime, setTourTime] = useState(currentTour.time);
  const [tourMaxTeams, setTourMaxTeams] = useState(currentTour.maxTeams);
  const [tourEntryFee, setTourEntryFee] = useState(currentTour.entryFee || '');
  const [tourPrizePool, setTourPrizePool] = useState(currentTour.prizePool || '');
  const [tourRoomId, setTourRoomId] = useState(currentTour.roomId || '');
  const [tourStatus, setTourStatus] = useState(currentTour.status);
  const [tourGroupsEnabled, setTourGroupsEnabled] = useState(currentTour.groupsEnabled === true);
  const [tourUnlimitedTeams, setTourUnlimitedTeams] = useState(currentTour.unlimitedTeams === true);
  const [tourUnlimitedGroups, setTourUnlimitedGroups] = useState(currentTour.unlimitedGroups === true || (currentTour.unlimitedTeams === true && (!currentTour.groupsEnabled || !currentTour.groupCount)));
  const [tourTeamsPerGroup, setTourTeamsPerGroup] = useState(currentTour.teamsPerGroup || DEFAULT_GROUP_SIZE);
  const [tourGroupCount, setTourGroupCount] = useState(currentTour.groupCount || 1);
  const [tourCardImage, setTourCardImage] = useState(currentTour.cardImageUrl || '');
  const [tourCardImageName, setTourCardImageName] = useState('');
  const [tourImageUploading, setTourImageUploading] = useState(false);
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
  const [newTourGroupsEnabled, setNewTourGroupsEnabled] = useState(false);
  const [newTourUnlimitedTeams, setNewTourUnlimitedTeams] = useState(false);
  const [newTourUnlimitedGroups, setNewTourUnlimitedGroups] = useState(false);
  const [newTourTeamsPerGroup, setNewTourTeamsPerGroup] = useState(DEFAULT_GROUP_SIZE);
  const [newTourGroupCount, setNewTourGroupCount] = useState(1);
  const [newTourCategory, setNewTourCategory] = useState<'practice' | 'free' | 'paid'>('practice');
  const [newTourEntryFee, setNewTourEntryFee] = useState('');
  const [newTourPrizePool, setNewTourPrizePool] = useState('');
  const [newTourRoomId, setNewTourRoomId] = useState('');
  const [newTourGroupLink, setNewTourGroupLink] = useState('');
  const [newTourCardImage, setNewTourCardImage] = useState('');
  const [newTourCardImageName, setNewTourCardImageName] = useState('');
  const [newTourImageUploading, setNewTourImageUploading] = useState(false);

  const [squadSearch, setSquadSearch] = useState('');
  const [squadTournamentFilter, setSquadTournamentFilter] = useState<string | null>(null);
  const [squadDeleteMessage, setSquadDeleteMessage] = useState<string | null>(null);
  const [deletingSquadName, setDeletingSquadName] = useState<string | null>(null);

  // Team Edit Modal State
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editLeaderName, setEditLeaderName] = useState('');

  // Logs State
  const [logs, setLogs] = useState<RegistrationLog[]>([]);
  const [teamContacts, setTeamContacts] = useState<{ id: string; teamName: string; whatsappNumber: string }[]>([]);
  const [expandedSquadKey, setExpandedSquadKey] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
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

  const handleTournamentImageUpload = async (file: File | undefined, mode: 'edit' | 'create') => {
    if (!file) return;
    const setUploading = mode === 'edit' ? setTourImageUploading : setNewTourImageUploading;
    setUploading(true);
    try {
      const imageData = await processTournamentImage(file);
      if (mode === 'edit') {
        setTourCardImage(imageData);
        setTourCardImageName(file.name);
      } else {
        setNewTourCardImage(imageData);
        setNewTourCardImageName(file.name);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not upload this image.');
    } finally {
      setUploading(false);
    }
  };

  // Match Results & Ranking State
  const [results, setResults] = useState<MatchResult[]>([]);
  const [resTeam, setResTeam] = useState('');
  const [resultsTournamentId, setResultsTournamentId] = useState(activeTournament.id);
  const [resMapNumber, setResMapNumber] = useState(1);
  const [resPosition, setResPosition] = useState(1);
  const [resKills, setResKills] = useState(0);
  const [resEarnings, setResEarnings] = useState(0);
  const [resSaving, setResSaving] = useState(false);
  const [resMsg, setResMsg] = useState<string | null>(null);
  const [showStandingsPreview, setShowStandingsPreview] = useState(false);
  const [previewTournamentId, setPreviewTournamentId] = useState(activeTournament.id);
  const [previewGroup, setPreviewGroup] = useState('all');
  const [previewMapNumber, setPreviewMapNumber] = useState(1);
  const [previewTableTheme, setPreviewTableTheme] = useState<keyof typeof STANDINGS_COLOR_THEMES>(() => {
    const savedTheme = localStorage.getItem('ogxo7_standings_table_theme');
    return savedTheme && savedTheme in STANDINGS_COLOR_THEMES ? savedTheme as keyof typeof STANDINGS_COLOR_THEMES : 'lime';
  });

  // Sync when activeTournament changes
  useEffect(() => {
    setCurrentTour(activeTournament);
    setResultsTournamentId(activeTournament.id);
    setTourName(activeTournament.name);
    setTourDate(activeTournament.date);
    setTourTime(activeTournament.time);
    setTourMaxTeams(activeTournament.maxTeams);
    setTourEntryFee(activeTournament.entryFee || '');
    setTourPrizePool(activeTournament.prizePool || '');
    setTourRoomId(activeTournament.roomId || '');
    setTourStatus(activeTournament.status);
    setTourGroupsEnabled(activeTournament.groupsEnabled === true || activeTournament.unlimitedTeams === true);
    setTourUnlimitedTeams(activeTournament.unlimitedTeams === true);
    setTourUnlimitedGroups(activeTournament.unlimitedGroups === true || (activeTournament.unlimitedTeams === true && (!activeTournament.groupsEnabled || !activeTournament.groupCount)));
    setTourTeamsPerGroup(activeTournament.teamsPerGroup || DEFAULT_GROUP_SIZE);
    setTourGroupCount(activeTournament.groupCount || 1);
    setTourCardImage(activeTournament.cardImageUrl || '');
    setRedirectLink(activeTournament.redirectLink || '');
    setRedirectEnabled(activeTournament.redirectLinkEnabled ?? true);
    setRedirectBtnText(activeTournament.redirectButtonText || 'Join Scrims Group');
  }, [activeTournament]);

  useEffect(() => {
    localStorage.setItem('ogxo7_standings_table_theme', previewTableTheme);
  }, [previewTableTheme]);

  // Load privileged data only after Firebase confirms this user is an admin.
  useEffect(() => {
    if (!isAdmin) {
      setLogs([]);
      setTeamContacts([]);
      setActivityLogs([]);
      setTeamAccounts([]);
      setTeamWallets([]);
      setResults([]);
      return;
    }

    void removePublicWhatsAppFromTeamRecords().catch((error) => {
      console.error('Could not remove legacy public WhatsApp fields:', error);
    });

    const unsubLogs = subscribeRegistrationLogs((fetchedLogs) => {
      setLogs(fetchedLogs);
      setLogsError(null);
    }, (error) => setLogsError(error instanceof Error ? error.message : 'Could not load registration logs.'));
    const unsubContacts = subscribeTeamAccountContacts((items) => setTeamContacts(items));
    const unsubActivity = subscribeAdminActivityLogs((items) => setActivityLogs(items));
    const unsubAccounts = subscribeTeamAccounts((items) => setTeamAccounts(items));
    const unsubWallets = subscribeTeamWallets((items) => setTeamWallets(items));
    const unsubResults = subscribeMatchResults((r) => setResults(r));
    return () => {
      unsubLogs();
      unsubContacts();
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
    setResultsTournamentId(tour.id);
    onSelectTournament(tour);
    setTourName(tour.name);
    setTourDate(tour.date);
    setTourTime(tour.time);
    setTourMaxTeams(tour.maxTeams);
    setTourEntryFee(tour.entryFee || '');
    setTourPrizePool(tour.prizePool || '');
    setTourRoomId(tour.roomId || '');
    setTourStatus(tour.status);
    setTourGroupsEnabled(tour.groupsEnabled === true || tour.unlimitedTeams === true);
    setTourUnlimitedTeams(tour.unlimitedTeams === true);
    setTourUnlimitedGroups(tour.unlimitedGroups === true || (tour.unlimitedTeams === true && (!tour.groupsEnabled || !tour.groupCount)));
    setTourTeamsPerGroup(tour.teamsPerGroup || DEFAULT_GROUP_SIZE);
    setTourGroupCount(tour.groupCount || 1);
    setTourCardImage(tour.cardImageUrl || '');
    setRedirectLink(tour.redirectLink || '');
    setRedirectEnabled(tour.redirectLinkEnabled ?? true);
    setRedirectBtnText(tour.redirectButtonText || 'Join Scrims Group');
  };

  const openTournamentTeams = (tour: Tournament) => {
    handleSelectTournament(tour);
    setSquadTournamentFilter(tour.id);
    setTab('squads');
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

  const copySquadLoginDetails = async (squad: { teamName: string; leaderName: string }) => {
    const publicUrl = new URL(window.location.href);
    publicUrl.searchParams.delete('panel');
    publicUrl.searchParams.delete('register');
    publicUrl.hash = '';
    const details = `Team login details\nLogin page: ${publicUrl.origin}${publicUrl.pathname}\nTeam name: ${squad.teamName}\nCaptain IGN: ${squad.leaderName}`;
    try {
      await navigator.clipboard.writeText(details);
      setCopiedDatabaseLogin(squadKey(squad.teamName));
      window.setTimeout(() => setCopiedDatabaseLogin(null), 2200);
    } catch {
      window.prompt('Copy team login details:', details);
    }
    setOpenDatabaseLoginMenu(null);
  };

  const copySquadPhone = async (squad: { teamName: string; whatsappNumber?: string }) => {
    if (!squad.whatsappNumber) return;
    try {
      await navigator.clipboard.writeText(squad.whatsappNumber);
      setCopiedDatabasePhone(squadKey(squad.teamName));
      window.setTimeout(() => setCopiedDatabasePhone(null), 2200);
    } catch {
      window.prompt('Copy WhatsApp number:', squad.whatsappNumber);
    }
  };

  const handleDeleteDatabaseRecord = async (squad: { teamName: string }) => {
    if (!confirm(`Delete ${squad.teamName} from the team database and remove its registrations from every tournament? Paid entry fees will be refunded to its wallet. This will keep the wallet and published match results.`)) return;
    setDeletingSquadName(squad.teamName);
    try {
      await deleteTeamDatabaseRecord(squad.teamName);
      recordAdminActivity('team_database_deleted', `Deleted ${squad.teamName}'s database profile and tournament registrations.`, squad.teamName);
    } catch (error) {
      alert(error instanceof Error ? `Could not delete team database record: ${error.message}` : 'Could not delete team database record.');
    } finally {
      setDeletingSquadName(null);
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
      const hasUnlimitedCapacity = tourUnlimitedTeams || tourUnlimitedGroups;
      const updatedCapacity = hasUnlimitedCapacity ? 2147483647 : tourGroupsEnabled ? tourGroupCount * tourTeamsPerGroup : Number(tourMaxTeams);
      if (!Number.isSafeInteger(updatedCapacity) || updatedCapacity < 1 || (!hasUnlimitedCapacity && updatedCapacity < currentTour.registeredCount)) {
        alert(`Capacity must be at least the ${currentTour.registeredCount} teams already registered.`);
        return;
      }
      await updateTournament(currentTour.id, {
        name: tourName,
        date: tourDate,
        time: tourTime,
        maxTeams: updatedCapacity,
        groupsEnabled: tourGroupsEnabled || tourUnlimitedGroups,
        unlimitedTeams: tourUnlimitedTeams || tourUnlimitedGroups,
        unlimitedGroups: tourUnlimitedGroups,
        teamsPerGroup: tourGroupsEnabled || tourUnlimitedGroups ? tourTeamsPerGroup : 0,
        groupCount: tourGroupsEnabled && !tourUnlimitedGroups ? tourGroupCount : 0,
        entryFee: currentTour.category === 'paid' ? tourEntryFee.trim() : '',
        entryFeeAmount: currentTour.category === 'paid' ? Number(tourEntryFee) || 0 : 0,
        prizePool: tourPrizePool.trim(),
        roomId: tourRoomId.trim(),
        status: !hasUnlimitedCapacity && updatedCapacity <= currentTour.registeredCount && tourStatus === 'open' ? 'closed' : tourStatus,
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
        prizePool: newTourPrizePool.trim(),
        roomId: newTourRoomId.trim(),
        date: newTourDate || new Date().toISOString().split('T')[0],
        time: newTourTime || '18:00 UTC',
        maxTeams: newTourGroupsEnabled ? newTourGroupCount * newTourTeamsPerGroup : Number(newTourMax) || 12,
        groupsEnabled: newTourGroupsEnabled || newTourUnlimitedGroups,
        unlimitedTeams: newTourUnlimitedTeams || newTourUnlimitedGroups,
        unlimitedGroups: newTourUnlimitedGroups,
        teamsPerGroup: newTourGroupsEnabled || newTourUnlimitedGroups ? newTourTeamsPerGroup : 0,
        groupCount: newTourGroupsEnabled ? newTourGroupCount : 0,
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
      setNewTourGroupsEnabled(false);
      setNewTourUnlimitedTeams(false);
      setNewTourUnlimitedGroups(false);
      setNewTourPrizePool('');
      setNewTourRoomId('');
      setNewTourGroupLink('');
      setNewTourCardImage('');
      setNewTourCardImageName('');
      setNewTourGroupsEnabled(false);
      setNewTourUnlimitedTeams(false);
      setNewTourTeamsPerGroup(DEFAULT_GROUP_SIZE);
      setNewTourGroupCount(1);
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

  // Match result handlers
  const handleAddResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setResMsg(null);
    if (!resTeam) {
      setResMsg('Age ekta team select korun.');
      return;
    }
    const selectedResultsTournament = tournaments.find((tournament) => tournament.id === resultsTournamentId) || currentTour;
    const duplicate = results.some((result) => result.tournamentId === selectedResultsTournament.id
      && (result.mapNumber || 1) === resMapNumber
      && result.teamName.trim().toLocaleLowerCase() === resTeam.trim().toLocaleLowerCase());
    if (duplicate) {
      setResMsg(`${resTeam} already has a result for Map ${resMapNumber}.`);
      return;
    }
    setResSaving(true);
    try {
      await addMatchResult({
        tournamentId: selectedResultsTournament.id,
        tournamentName: selectedResultsTournament.name,
        teamName: resTeam,
        mapNumber: resMapNumber,
        position: Number(resPosition),
        kills: Math.max(0, Number(resKills) || 0),
        earnings: Math.max(0, Number(resEarnings) || 0),
      });
      void writeAdminActivityLog({ eventType: 'match_result_added', summary: `Saved Map ${resMapNumber}, rank #${resPosition} for ${resTeam}.`, tournamentId: selectedResultsTournament.id, tournamentName: selectedResultsTournament.name, teamName: resTeam }).catch((error) => console.warn('Could not save admin activity log:', error));
      setResMsg(`✅ ${resTeam} — Map ${resMapNumber}, rank #${resPosition} saved.`);
      setResKills(0);
      setResEarnings(0);
      setResPosition(1);
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
    const selectedResultsTournament = tournaments.find((tournament) => tournament.id === resultsTournamentId) || currentTour;
    const themeChanged = selectedResultsTournament.standingsTheme !== previewTableTheme;
    if (!draftTourResults.length && !themeChanged) return;
    const publishSummary = [draftTourResults.length ? `${draftTourResults.length} result(s)` : '', themeChanged ? 'the standings table color' : ''].filter(Boolean).join(' and ');
    if (!confirm(`Publish ${publishSummary} for ${selectedResultsTournament.name} so teams can view them in My Tournaments?`)) return;
    try {
      const publishedCount = await publishTournamentResults(selectedResultsTournament.id, previewTableTheme);
      void writeAdminActivityLog({ eventType: 'match_results_published', summary: `Published ${publishedCount} result(s) for ${selectedResultsTournament.name}.`, tournamentId: selectedResultsTournament.id, tournamentName: selectedResultsTournament.name }).catch((error) => console.warn('Could not save admin activity log:', error));
      setResMsg(`✅ Published ${publishedCount} result(s) and standings table for teams.`);
      window.setTimeout(() => setResMsg(null), 3000);
    } catch (err) {
      setResMsg(`❌ ${err instanceof Error ? err.message : 'Could not publish results.'}`);
    }
  };

  const selectedResultsTournament = tournaments.find((tournament) => tournament.id === resultsTournamentId) || currentTour;
  const resultRegisteredTeams = (() => {
    const sourceTeams = allRegisteredTeams.filter((team) => team.tournamentId === selectedResultsTournament.id && team.status === 'approved');
    const teamsForSelectedTournament = sourceTeams.length ? sourceTeams : teams.filter((team) => team.tournamentId === selectedResultsTournament.id && team.status === 'approved');
    return [...teamsForSelectedTournament].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.teamName.localeCompare(b.teamName));
  })();
  const tourResults = results
    .filter((r) => r.tournamentId === selectedResultsTournament.id)
    .sort((a, b) => (a.mapNumber || 1) - (b.mapNumber || 1) || a.position - b.position || b.kills - a.kills);
  const selectedMapResults = tourResults.filter((result) => (result.mapNumber || 1) === resMapNumber);
  const selectedMapRows = [...resultRegisteredTeams].sort((a, b) => {
    const aResult = selectedMapResults.find((result) => result.teamName.trim().toLocaleLowerCase() === a.teamName.trim().toLocaleLowerCase());
    const bResult = selectedMapResults.find((result) => result.teamName.trim().toLocaleLowerCase() === b.teamName.trim().toLocaleLowerCase());
    if (aResult && bResult) return aResult.position - bResult.position || bResult.kills - aResult.kills;
    if (aResult) return -1;
    if (bResult) return 1;
    return (a.createdAt || '').localeCompare(b.createdAt || '') || a.teamName.localeCompare(b.teamName);
  });
  const previewTournament = tournaments.find((tournament) => tournament.id === previewTournamentId) || selectedResultsTournament;
  const previewRegisteredTeamsSource = allRegisteredTeams.filter((team) => team.tournamentId === previewTournament.id && team.status === 'approved');
  const previewRegisteredTeams = [...(previewRegisteredTeamsSource.length ? previewRegisteredTeamsSource : teams.filter((team) => team.tournamentId === previewTournament.id && team.status === 'approved'))]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));
  const previewGroupsEnabled = previewTournament.groupsEnabled === true || previewTournament.unlimitedGroups === true || previewTournament.unlimitedTeams === true;
  const previewTeamsPerGroup = previewTournament.teamsPerGroup || DEFAULT_GROUP_SIZE;
  const previewGroupCount = previewGroupsEnabled ? Math.max(1, Number(previewTournament.groupCount) || Math.ceil(previewRegisteredTeams.length / previewTeamsPerGroup) || 1) : 0;
  const previewTeamGroups = new Map(previewRegisteredTeams.map((team, index) => [team.teamName.trim().toLocaleLowerCase(), resultGroupLabel(Math.floor(index / previewTeamsPerGroup))]));
  const previewGroupOptions = previewGroupsEnabled ? Array.from({ length: previewGroupCount }, (_, index) => resultGroupLabel(index)) : [];
  const previewTournamentResults = results.filter((result) => result.tournamentId === previewTournament.id);
  const previewMapOptions = Array.from(new Set([...previewTournamentResults.map((result) => result.mapNumber || 1), previewMapNumber])).sort((a, b) => a - b);
  const standingsTheme = STANDINGS_COLOR_THEMES[previewTableTheme];
  const previewRows = previewRegisteredTeams
    .filter((team) => previewGroup === 'all' || previewTeamGroups.get(team.teamName.trim().toLocaleLowerCase()) === previewGroup)
    .map((team) => ({
      team,
      group: previewTeamGroups.get(team.teamName.trim().toLocaleLowerCase()) || 'OPEN FIELD',
      result: previewTournamentResults.find((entry) => (entry.mapNumber || 1) === previewMapNumber && entry.teamName.trim().toLocaleLowerCase() === team.teamName.trim().toLocaleLowerCase()),
    }))
    .sort((a, b) => {
      if (a.result && b.result) return a.result.position - b.result.position || b.result.kills - a.result.kills;
      if (a.result) return -1;
      if (b.result) return 1;
      return new Date(a.team.createdAt).getTime() - new Date(b.team.createdAt).getTime() || a.team.id.localeCompare(b.team.id);
    });
  const draftTourResults = tourResults.filter((result) => result.published === false);
  const publishedTourResults = results
    .filter((result) => result.published !== false)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Filter teams for current tournament
  const currentTourTeams = teams.filter((t) => t.tournamentId === currentTour.id);
  const activeScrims = tournaments.filter((tournament) => tournament.status !== 'completed');
  const tournamentsWithSlots = activeScrims;
  const activeTournamentIds = new Set(activeScrims.map((tournament) => tournament.id));
  const activeScrimTeams = allRegisteredTeams.filter((team) => activeTournamentIds.has(team.tournamentId) && team.status === 'approved');
  const liveRegisteredTeamCount = activeScrims.reduce((count, tournament) => count + Math.max(0, Number(tournament.registeredCount) || 0), 0);
  const liveRemainingSlotCount = activeScrims.reduce((count, tournament) => count + (tournament.unlimitedTeams ? 0 : Math.max(0, tournament.maxTeams - tournament.registeredCount)), 0);
  const livePlayerCount = activeScrimTeams.reduce((count, team) => count + (team.players?.length || 0), 0);
  const completedScrims = tournaments.filter((tournament) => tournament.status === 'completed').sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  const visibleWallets = teamWallets.filter((wallet) => wallet.teamName.toLocaleLowerCase().includes(walletSearch.toLocaleLowerCase().trim()));
  const registeredWalletTeamNames = Array.from(new Set([
    ...teamAccounts.filter((account) => account.status === 'approved' || account.status === 'pending').map((account) => account.teamName.trim()),
    ...allRegisteredTeams.filter((team) => team.status === 'approved').map((team) => team.teamName.trim()),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const searchedWalletTeamNames = registeredWalletTeamNames.filter((name) => name.toLocaleLowerCase().includes(walletTeamSearch.toLocaleLowerCase().trim()));
  const squadKey = (name: string) => name.trim().toLocaleLowerCase();
  const adminPhoneByTeam = new Map<string, string>();
  teamContacts.forEach((contact) => adminPhoneByTeam.set(squadKey(contact.teamName), contact.whatsappNumber));
  [...logs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).forEach((log) => {
    if (log.whatsappNumber) adminPhoneByTeam.set(squadKey(log.teamName), log.whatsappNumber);
  });
  const registeredSquadMap = new Map<string, { teamName: string; teamLogo?: string; leaderName: string; players: Player[]; status: string; createdAt: string; whatsappNumber?: string; registrations: { id: string; name: string }[] }>();
  teamAccounts.forEach((account) => registeredSquadMap.set(squadKey(account.teamName), { teamName: account.teamName, teamLogo: account.teamLogo, leaderName: account.leaderName || '', players: account.players || [], status: account.status, createdAt: account.createdAt, whatsappNumber: adminPhoneByTeam.get(squadKey(account.teamName)), registrations: [] }));
  allRegisteredTeams.forEach((team) => {
    const key = squadKey(team.teamName);
    const existing = registeredSquadMap.get(key);
    const tournament = tournaments.find((item) => item.id === team.tournamentId);
    if (existing) {
      existing.whatsappNumber = adminPhoneByTeam.get(key) || existing.whatsappNumber;
      existing.registrations.push({ id: team.tournamentId, name: tournament?.name || team.tournamentId });
    } else registeredSquadMap.set(key, { teamName: team.teamName, teamLogo: team.teamLogo, leaderName: team.leaderName || '', players: team.players || [], status: team.status, createdAt: team.createdAt, whatsappNumber: adminPhoneByTeam.get(key) || team.whatsappNumber, registrations: [{ id: team.tournamentId, name: tournament?.name || team.tournamentId }] });
  });
  const registeredSquads = Array.from(registeredSquadMap.values()).sort((a, b) => a.teamName.localeCompare(b.teamName, undefined, { sensitivity: 'base' }));
  const visibleRegisteredSquads = registeredSquads.filter((squad) => {
    const matchesTournament = !squadTournamentFilter || squad.registrations.some((registration) => registration.id === squadTournamentFilter);
    const query = squadSearch.toLocaleLowerCase().trim();
    const matchesQuery = !query || `${squad.teamName} ${squad.leaderName} ${squad.players.map((player) => player.name).join(' ')} ${squad.registrations.map((registration) => registration.name).join(' ')}`.toLocaleLowerCase().includes(query);
    return matchesTournament && matchesQuery;
  });
  const visibleDatabaseSquads = registeredSquads.filter((squad) => {
    const q = databaseTeamSearch.toLocaleLowerCase().trim();
    return !q || `${squad.teamName} ${squad.players.map((player) => player.name).join(' ')}`.toLocaleLowerCase().includes(q);
  });
  const handleRemoveSquadFromTournament = async (squad: (typeof registeredSquads)[number]) => {
    if (!squadTournamentFilter) return;
    const registration = allRegisteredTeams.find((team) => team.tournamentId === squadTournamentFilter
      && squadKey(team.teamName) === squadKey(squad.teamName));
    if (!registration) return;
    const tournamentName = tournaments.find((item) => item.id === squadTournamentFilter)?.name || 'this tournament';
    const refundText = tournaments.find((item) => item.id === squadTournamentFilter)?.category === 'paid'
      ? ' The entry fee will be returned to the team wallet.'
      : '';
    if (!confirm(`Remove ${squad.teamName} from ${tournamentName} only? The team account and its other tournament records will stay, and it can register here again.${refundText}`)) return;
    setDeletingSquadName(squad.teamName);
    setSquadDeleteMessage(null);
    try {
      await deleteTeam(registration.tournamentId, registration.id);
      recordAdminActivity('team_removed', `Removed ${squad.teamName} from ${tournamentName}; the squad account and other registrations remain available.`, squad.teamName);
      setSquadDeleteMessage(`${squad.teamName} was removed from ${tournamentName}. It can register again.`);
    } catch (error) {
      setSquadDeleteMessage(error instanceof Error ? `Remove failed: ${error.message}` : 'Remove failed. Please retry.');
    } finally {
      setDeletingSquadName(null);
    }
  };
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
                  { id: 'database', label: `Team Database (${registeredSquads.length})`, icon: Search },
                  { id: 'wallets', label: `Team Wallet (${teamWallets.length})`, icon: Wallet },
                  { id: 'results', label: `Results (${draftTourResults.length})`, icon: Trophy },
                  { id: 'history', label: `Match History (${publishedTourResults.length + completedScrims.length})`, icon: HistoryIcon },
                  { id: 'logs', label: `Activity Logs (${logs.length + activityLogs.length})`, icon: ListFilter },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" title={item.label} onClick={() => { if (item.id === 'squads') setSquadTournamentFilter(null); setTab(item.id as typeof tab); }} className={`admin-side-link flex items-center gap-2.5 rounded-xl px-3 py-3 text-left text-xs font-bold transition-all ${tab === item.id ? 'is-active' : 'text-slate-400 hover:bg-white/[.04] hover:text-white'}`}>
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
                      <p className="mt-1 text-xs text-slate-400">Select a scrim to see its registered teams, results, and settings.</p>
                    </div>
                    <button type="button" onClick={() => setShowCreateTour(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-orange-950/25 transition hover:-translate-y-0.5 hover:brightness-110">
                      <Plus size={15} /> New Scrim
                    </button>
                  </div>
                  {activeScrims.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No active scrims. Create a new scrim or view completed tournaments in Match History.</div> : (
                    <div className="space-y-2.5">
                      {activeScrims.map((tour) => {
                        const selected = tour.id === currentTour.id;
                        const full = !tour.unlimitedTeams && tour.registeredCount >= tour.maxTeams;
                        return (
                          <article key={tour.id} onDoubleClick={() => openTournamentTeams(tour)} title="Double-click to view registered teams" className={`cursor-pointer rounded-2xl border p-4 transition-all ${selected ? 'border-orange-300/35 bg-orange-300/[.045] shadow-lg shadow-orange-950/10' : 'border-[#282934] bg-[#15161d] hover:border-white/15'}`}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button type="button" onClick={() => handleSelectTournament(tour)} onDoubleClick={() => openTournamentTeams(tour)} className="truncate text-left text-sm font-bold text-white transition hover:text-orange-100">{tour.name}</button>
                                  {selected && <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-2 py-0.5 text-[9px] font-bold uppercase text-orange-200">Selected</span>}
                                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${full ? 'border-rose-300/20 bg-rose-300/10 text-rose-200' : tour.status === 'open' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-white/[.04] text-slate-400'}`}>{full ? 'Full' : tour.status}</span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                  <span>{tour.date} · {tour.time}</span><span>{tour.registeredCount}/{tour.unlimitedTeams ? '∞' : tour.maxTeams} teams{tour.groupsEnabled ? (tour.unlimitedGroups ? ` · Unlimited groups × ${tour.teamsPerGroup}` : ` · ${tour.groupCount} groups × ${tour.teamsPerGroup}`) : ''}</span>
                                  {tour.category === 'paid' && tour.entryFee && <span className="font-bold text-amber-200">৳{Number(tour.entryFee).toLocaleString()} / team</span>}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button type="button" onClick={() => { handleSelectTournament(tour); setSquadTournamentFilter(tour.id); setTab('squads'); }} className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.05] px-3 py-2.5 text-[10px] font-bold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[.1]">Teams · {tour.registeredCount}</button>
                                <div className="relative" onDoubleClick={(event) => event.stopPropagation()}>
                                <button type="button" aria-label={`Actions for ${tour.name}`} aria-expanded={openScrimMenu === tour.id} onClick={() => setOpenScrimMenu((open) => open === tour.id ? null : tour.id)} className="rounded-xl border border-white/10 bg-white/[.04] p-2.5 text-slate-300 transition hover:border-orange-300/25 hover:bg-orange-300/[.07] hover:text-white"><MoreVertical size={17} /></button>
                                {openScrimMenu === tour.id && <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#191a22] p-1.5 shadow-2xl">
                                  <button type="button" onClick={() => { handleSelectTournament(tour); setSquadTournamentFilter(tour.id); setTab('squads'); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/[.06]">View registered teams</button>
                                  <button type="button" onClick={() => { handleSelectTournament(tour); setTab('tournament'); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Edit tournament info</button>
                                  <button type="button" onClick={() => { handleSelectTournament(tour); setTab('redirect'); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Edit CG Group link</button>
                                  <button type="button" disabled={full && tour.status !== 'open'} onClick={() => { void handleToggleRegistration(tour); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06] disabled:opacity-40">{tour.status === 'open' ? 'Close registration' : 'Open registration'}</button>
                                  <button type="button" onClick={() => { void copyRegistrationLink(tour.id); setOpenScrimMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-indigo-200 hover:bg-indigo-300/[.08]">{copiedRegistrationLink === tour.id ? 'Link copied' : 'Copy registration link'}</button>
                                  <button type="button" onClick={() => void handleCompleteTournament(tour)} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-emerald-200 hover:bg-emerald-300/[.08]">Complete tournament</button>
                                  <div className="my-1 border-t border-white/[.07]" />
                                  <button type="button" onClick={() => { setOpenScrimMenu(null); void handleDeleteTournament(tour.id); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-rose-200 hover:bg-rose-300/[.08]">Delete tournament</button>
                                </div>}
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {tab === 'squads' && (
                <section className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-200">Squad directory</div><h3 className="mt-1 text-lg font-extrabold text-white">Registered Teams</h3><p className="mt-1 text-xs text-slate-400">Every registered squad, its players, and scrims joined.</p></div>
                    <label className="relative block"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={squadSearch} onChange={(event) => setSquadSearch(event.target.value)} placeholder="Search team, IGN, or scrim" className="w-full rounded-lg border border-white/10 bg-[#0b0c10] py-2 pl-8 pr-3 text-[11px] text-white outline-none focus:border-cyan-300/30 sm:w-64"/></label>
                  </div>
                  {squadTournamentFilter && <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.04] px-3 py-2 text-[11px] text-cyan-100"><span>Tournament: {tournaments.find((item) => item.id === squadTournamentFilter)?.name || 'Selected scrim'}</span></div>}
                  {squadDeleteMessage && <div role="status" className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-[11px] text-slate-200">{squadDeleteMessage}</div>}
                  {visibleRegisteredSquads.length ? <div className="space-y-2">{visibleRegisteredSquads.map((squad, index) => {
                    const key = squadKey(squad.teamName);
                    const expanded = expandedSquadKey === key;
                    const whatsappHref = squad.whatsappNumber
                      ? `https://wa.me/${squad.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Assalamu alaikum ${squad.teamName}! ${squad.registrations.length ? `Tournament(s): ${squad.registrations.map((registration) => registration.name).join(', ')}. ` : ''}Players: ${squad.players.map((player) => player.name).join(', ')}.`)}`
                      : undefined;
                    return <article key={key} className="wallet-card overflow-hidden rounded-xl border border-white/[.08] bg-[#151720]" style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}>
                      <div className="flex items-center gap-2.5 px-3 py-2">
                        <button type="button" onClick={() => setExpandedSquadKey(expanded ? null : key)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2.5 text-left hover:opacity-90">
                          <span className="text-[10px] font-bold tabular-nums text-cyan-200">{String(index + 1).padStart(2, '0')}.</span>
                          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">{squad.teamLogo ? <img src={squad.teamLogo} alt="" className="h-full w-full object-cover"/> : <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-cyan-200">{squad.teamName.slice(0, 2).toUpperCase()}</span>}</span>
                          <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><strong className="truncate text-xs font-extrabold text-white">{squad.teamName}</strong><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-200">{squad.status}</span></span><span className="mt-0.5 block truncate text-[10px] text-slate-400">Captain: <b className="text-slate-200">{squad.leaderName || '—'}</b>{squad.whatsappNumber && <span className="ml-2 text-emerald-200">{squad.whatsappNumber}</span>}</span></span>
                          {expanded ? <ChevronUp size={15} className="shrink-0 text-slate-400"/> : <ChevronDown size={15} className="shrink-0 text-slate-400"/>}
                        </button>
                        {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" aria-label={`Message ${squad.teamName} on WhatsApp`} title="Send WhatsApp message" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/[.07] text-emerald-200 hover:bg-emerald-300/15"><MessageCircle size={15}/></a> : <span title="No WhatsApp number saved" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[.06] text-slate-600"><MessageCircle size={14}/></span>}
                        {squadTournamentFilter && <button type="button" disabled={deletingSquadName === squad.teamName} onClick={() => void handleRemoveSquadFromTournament(squad)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-300/15 bg-rose-300/[.06] px-2 py-2 text-[9px] font-bold text-rose-200 transition hover:bg-rose-300/[.12] disabled:opacity-50"><Trash2 size={12}/><span className="hidden sm:inline">{deletingSquadName === squad.teamName ? 'Removing…' : 'Remove from scrim'}</span></button>}
                      </div>
                      {expanded && <div className="grid gap-3 border-t border-white/[.07] bg-black/10 px-3 py-3 sm:grid-cols-2">
                        <div><div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Player names</div><div className="flex flex-wrap gap-1">{squad.players.map((player) => <span key={`${key}-${player.slotIndex}-${player.name}`} className="rounded-md border border-white/[.07] bg-black/20 px-2 py-1 text-[10px] text-slate-300">{player.role === 'backup' ? 'Backup' : `P${player.slotIndex}`} · {player.name}</span>)}</div></div>
                        <div><div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Tournament registrations</div><div className="flex flex-wrap gap-1">{squad.registrations.map((registration) => <span key={`${registration.id}-${key}`} className="rounded-md border border-indigo-300/15 bg-indigo-300/[.06] px-2 py-1 text-[10px] text-indigo-100">{registration.name}</span>)}{!squad.registrations.length && <span className="text-[10px] text-slate-500">No tournament registrations yet</span>}</div></div>
                      </div>}
                    </article>;
                  })}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">{registeredSquads.length ? 'No team matches this filter.' : 'Registered teams will appear here as soon as a squad account or scrim entry exists.'}</div>}
                </section>
              )}

              {tab === 'database' && (
                <section className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-200">Team database</div><h3 className="mt-1 text-lg font-extrabold text-white">All Squads ({registeredSquads.length})</h3><p className="mt-1 text-xs text-slate-400">Open a team to see its player IGNs. WhatsApp numbers are visible to admins only.</p></div>
                    <label className="relative block"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={databaseTeamSearch} onChange={(event) => setDatabaseTeamSearch(event.target.value)} placeholder="Search team or player IGN" className="w-full rounded-lg border border-white/10 bg-[#0b0c10] py-2 pl-8 pr-3 text-[11px] text-white outline-none focus:border-cyan-300/30 sm:w-64"/></label>
                  </div>
                  {visibleDatabaseSquads.length ? <div className="space-y-2">{visibleDatabaseSquads.map((squad) => {
                    const key = squadKey(squad.teamName);
                    const expanded = expandedDatabaseTeam === key;
                    const message = `Assalamu alaikum ${squad.teamName}! Players: ${squad.players.map((player) => player.name).join(', ')}.`;
                    const whatsappHref = squad.whatsappNumber ? `https://wa.me/${squad.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : undefined;
                    return <article key={key} className={`relative rounded-xl border border-white/[.08] bg-[#151720] ${openDatabaseLoginMenu === key ? 'z-20' : 'z-0'}`}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button type="button" onClick={() => setExpandedDatabaseTeam(expanded ? null : key)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">{squad.teamLogo ? <img src={squad.teamLogo} alt="" className="h-full w-full object-cover"/> : <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-cyan-200">{squad.teamName.slice(0, 2).toUpperCase()}</span>}</span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-white">{squad.teamName}</span>{squad.whatsappNumber && <span className="mt-0.5 block truncate text-[10px] text-emerald-200">WhatsApp: {squad.whatsappNumber}</span>}</span>
                          <span className="shrink-0 text-[10px] text-slate-500">{squad.players.length} players</span>
                          {expanded ? <ChevronUp size={14} className="ml-auto shrink-0 text-slate-400"/> : <ChevronDown size={14} className="ml-auto shrink-0 text-slate-400"/>}
                        </button>
                        {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" aria-label={`Message ${squad.teamName} on WhatsApp`} title={`Send WhatsApp message${squad.whatsappNumber ? ` to ${squad.whatsappNumber}` : ''}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/[.07] text-emerald-200 hover:bg-emerald-300/15"><MessageCircle size={15}/></a> : <span title="No WhatsApp number saved" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[.06] text-slate-600"><MessageCircle size={14}/></span>}
                        {squad.whatsappNumber && <button type="button" onClick={() => void copySquadPhone(squad)} aria-label={`Copy ${squad.teamName} WhatsApp number`} title={copiedDatabasePhone === key ? 'Number copied' : 'Copy WhatsApp number'} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[.08] bg-white/[.03] text-slate-400 hover:bg-white/[.08] hover:text-white">{copiedDatabasePhone === key ? <Check size={14} className="text-emerald-300"/> : <Copy size={14}/>}</button>}
                        <div className="relative shrink-0">
                          <button type="button" aria-label={`More options for ${squad.teamName}`} aria-expanded={openDatabaseLoginMenu === key} onClick={() => setOpenDatabaseLoginMenu((open) => open === key ? null : key)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[.08] bg-white/[.03] text-slate-400 hover:bg-white/[.08] hover:text-white"><MoreVertical size={15}/></button>
                          {openDatabaseLoginMenu === key && <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-white/10 bg-[#191a22] p-1.5 shadow-2xl"><button type="button" onClick={() => void copySquadLoginDetails(squad)} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/[.07]">{copiedDatabaseLogin === key ? 'Copied login details' : 'Copy login details'}</button><button type="button" disabled={deletingSquadName === squad.teamName} onClick={() => { setOpenDatabaseLoginMenu(null); void handleDeleteDatabaseRecord(squad); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-rose-200 hover:bg-rose-300/[.08] disabled:opacity-50">{deletingSquadName === squad.teamName ? 'Deleting…' : 'Delete database record'}</button></div>}
                        </div>
                      </div>
                      {expanded && <div className="flex flex-wrap gap-1.5 border-t border-white/[.07] bg-black/10 px-3 py-2.5">{squad.players.map((player) => <span key={`${key}-${player.slotIndex}-${player.name}`} className="rounded-md border border-white/[.07] bg-black/20 px-2 py-1 text-[10px] text-slate-300">{player.name}</span>)}</div>}
                    </article>;
                  })}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">{registeredSquads.length ? 'No team matches this search.' : 'Teams saved in the database will appear here.'}</div>}
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
                  <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-200">Organizer workspace</div><h3 className="mt-1 text-lg font-extrabold text-white">Overview</h3></div><div className="relative"><button type="button" aria-label="Overview settings" aria-expanded={openOverviewMenu} onClick={() => setOpenOverviewMenu((open) => !open)} className="rounded-xl border border-white/10 bg-white/[.04] p-2.5 text-slate-300 transition hover:border-orange-300/25 hover:text-white"><MoreVertical size={17} /></button>{openOverviewMenu && <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-white/10 bg-[#191a22] p-1.5 shadow-2xl"><button type="button" onClick={() => { setTab('tournament'); setOpenOverviewMenu(false); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/[.06]">Edit tournament info</button><button type="button" onClick={() => { setTab('redirect'); setOpenOverviewMenu(false); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">CG Group link</button><button type="button" onClick={() => { setTab('discord'); setOpenOverviewMenu(false); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Discord event logs</button></div>}</div></div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]"><div className="text-xs text-gray-400">Live Scrims</div><div className="text-2xl font-bold text-white mt-1">{activeScrims.length}</div></div>
                    <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]"><div className="text-xs text-gray-400">Teams in Live Scrims</div><div className="text-2xl font-bold text-indigo-400 mt-1">{liveRegisteredTeamCount}</div></div>
                    <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]"><div className="text-xs text-gray-400">Live Slots Left</div><div className="text-2xl font-bold text-emerald-400 mt-1">{liveRemainingSlotCount}</div></div>
                    <div className="bg-[#15161d] p-4 rounded-xl border border-[#272833]"><div className="text-xs text-gray-400">Players in Live Scrims</div><div className="text-2xl font-bold text-purple-400 mt-1">{livePlayerCount}</div></div>
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
                          <div key={t.id} onDoubleClick={() => openTournamentTeams(t)} title="Double-click to view registered teams" className="cursor-pointer py-2.5 flex items-center justify-between gap-3 text-xs">
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
                              {t.registeredCount} / {t.unlimitedTeams ? 'Unlimited' : t.maxTeams} Teams
                            </span>
                            <div className="relative" onDoubleClick={(event) => event.stopPropagation()}><button type="button" aria-label={`Actions for ${t.name}`} aria-expanded={openOverviewTourMenu === t.id} onClick={() => setOpenOverviewTourMenu((open) => open === t.id ? null : t.id)} className="rounded-lg border border-white/10 bg-white/[.04] p-2 text-slate-300 hover:text-white"><MoreVertical size={15} /></button>{openOverviewTourMenu === t.id && <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-white/10 bg-[#191a22] p-1.5 shadow-2xl"><button type="button" onClick={() => { openTournamentTeams(t); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/[.06]">View registered teams</button><button type="button" onClick={() => { handleSelectTournament(t); setTab('tournament'); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Edit tournament info</button><button type="button" onClick={() => { handleSelectTournament(t); setTab('redirect'); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">Edit CG Group link</button><button type="button" onClick={() => { void copyRegistrationLink(t.id); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-indigo-200 hover:bg-indigo-300/[.08]">{copiedRegistrationLink === t.id ? 'Link copied' : 'Copy registration link'}</button><button type="button" onClick={() => { void handleToggleRegistration(t); setOpenOverviewTourMenu(null); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-white/[.06]">{t.status === 'open' ? 'Close registration' : 'Open registration'}</button><div className="my-1 border-t border-white/[.07]"/><button type="button" onClick={() => { setOpenOverviewTourMenu(null); void handleDeleteTournament(t.id); }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-rose-200 hover:bg-rose-300/[.08]">Delete tournament</button></div>}</div>
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
              {false && (
                <div className="space-y-4">
                  <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-200">Scrim entries</div><h3 className="mt-1 text-lg font-extrabold text-white">{currentTour.name}</h3><p className="mt-1 text-xs text-slate-400">Teams registered for this scrim: {currentTourTeams.length}.</p></div>
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
                        disabled={!currentTour.id || currentTour.status !== 'open' || (!currentTour.unlimitedTeams && currentTour.registeredCount >= currentTour.maxTeams)}
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
                <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300/15 bg-gradient-to-r from-emerald-500/[.08] to-cyan-500/[.04] px-4 py-3">
                  <div><div className="text-xs font-extrabold uppercase tracking-wider text-white">Publish tournament standings</div><p className="mt-1 text-[10px] text-slate-400">Teams can view published results from My Tournaments.</p></div>
                  <button type="button" disabled={!draftTourResults.length && selectedResultsTournament.standingsTheme === previewTableTheme} onClick={() => void handlePublishResults()} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-emerald-950/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={15} /> Publish Results ({draftTourResults.length})</button>
                </div>
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
                  <div className="xl:col-span-2 space-y-4">
                    <form onSubmit={handleAddResult} className="bg-[#15161d] border border-[#272833] rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy size={14} /> Add Match Result
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Choose a tournament, then add each registered squad’s Map, position and kills. Points calculate automatically.
                      </p>

                      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                        <label className="block text-xs text-gray-400">Tournament
                          <select value={resultsTournamentId} onChange={(event) => { setResultsTournamentId(event.target.value); setResTeam(''); setResMapNumber(1); setResMsg(null); }} className="mt-1 w-full rounded-xl border border-[#2a2b36] bg-[#0b0c10] px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                            {tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}
                          </select>
                        </label>
                        <label className="block text-xs text-gray-400">Map #
                          <input type="number" min="1" max="99" value={resMapNumber} onChange={(event) => setResMapNumber(Math.max(1, Math.floor(Number(event.target.value) || 1)))} className="mt-1 w-full rounded-xl border border-[#2a2b36] bg-[#0b0c10] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500" />
                        </label>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-cyan-300/10 bg-cyan-300/[.04] px-3 py-2 text-[10px] text-cyan-100">
                        <span>{resultRegisteredTeams.length} registered teams</span>
                        <span>{new Set(tourResults.map((result) => result.mapNumber || 1)).size} maps entered</span>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Registered team</label>
                        <select
                          value={resTeam}
                          onChange={(e) => setResTeam(e.target.value)}
                          className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">— Select registered team —</option>
                          {resultRegisteredTeams.map((t, index) => (
                            <option key={t.id} value={t.teamName}>
                              {String(index + 1).padStart(2, '0')} · {t.teamName}
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

                    <section className="overflow-hidden rounded-xl border border-[#272833] bg-[#15161d]">
                      <div className="flex items-center justify-between border-b border-white/[.06] px-3.5 py-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-300">Registered teams</div>
                        <span className="rounded-md border border-cyan-300/15 bg-cyan-300/[.06] px-2 py-1 text-[9px] font-bold text-cyan-100">MAP {resMapNumber}</span>
                      </div>
                      {resultRegisteredTeams.length ? <div className="max-h-64 divide-y divide-white/[.05] overflow-y-auto">
                        {resultRegisteredTeams.map((team, index) => {
                          const saved = tourResults.some((result) => (result.mapNumber || 1) === resMapNumber && result.teamName.trim().toLocaleLowerCase() === team.teamName.trim().toLocaleLowerCase());
                          return <button key={team.id} type="button" disabled={saved} onClick={() => { setResTeam(team.teamName); setResMsg(null); }} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-white/[.035] disabled:cursor-default">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/30 text-[10px] font-black tabular-nums text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{team.teamName}</span>
                            {saved ? <span className="shrink-0 rounded-md border border-emerald-300/15 bg-emerald-300/[.06] px-2 py-1 text-[9px] font-bold text-emerald-200">ADDED</span> : <span className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-bold ${resTeam === team.teamName ? 'bg-amber-300/15 text-amber-100' : 'bg-white/[.05] text-slate-400'}`}>{resTeam === team.teamName ? 'SELECTED' : 'SELECT'}</span>}
                          </button>;
                        })}
                      </div> : <p className="px-3.5 py-5 text-center text-[11px] text-gray-500">No approved teams registered for this tournament.</p>}
                    </section>


                  </div>

                  <div className="xl:col-span-3 bg-[#15161d] border border-[#272833] rounded-xl p-4">
                    <section className="mb-4 overflow-hidden rounded-xl border border-cyan-300/15 bg-[#0e1117]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.06] px-3.5 py-3">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-white">Map {resMapNumber} entry preview</div>
                          <div className="mt-1 text-[10px] text-slate-500">{selectedResultsTournament.name} · {selectedMapResults.length}/{resultRegisteredTeams.length} teams entered</div>
                        </div>
                        <button type="button" onClick={() => { setPreviewTournamentId(resultsTournamentId); setPreviewGroup((selectedResultsTournament.groupsEnabled || selectedResultsTournament.unlimitedGroups || selectedResultsTournament.unlimitedTeams) ? resultGroupLabel(0) : 'all'); setPreviewMapNumber(resMapNumber); setShowStandingsPreview(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-lime-300/25 bg-lime-300/[.08] px-3 py-2 text-[10px] font-extrabold text-lime-100 transition hover:bg-lime-300/[.15]"><Eye size={13} /> Preview standings</button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left text-[10px]">
                          <thead className="bg-white/[.025] text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            <tr><th className="px-3 py-2.5">#</th><th className="px-3 py-2.5">Team name</th><th className="px-3 py-2.5 text-center">Booyah</th><th className="px-3 py-2.5 text-center">Kills</th><th className="px-3 py-2.5 text-center">Position points</th><th className="px-3 py-2.5 text-right">Total</th></tr>
                          </thead>
                          <tbody className="divide-y divide-white/[.05]">
                            {selectedMapRows.length ? selectedMapRows.map((team, index) => {
                              const result = selectedMapResults.find((entry) => entry.teamName.trim().toLocaleLowerCase() === team.teamName.trim().toLocaleLowerCase());
                              const placementPoints = result ? calcPoints(result.position, 0) : 0;
                              return <tr key={team.id} className={result?.position === 1 ? 'bg-amber-300/[.035]' : ''}>
                                <td className="px-3 py-2.5 font-black tabular-nums text-slate-500">{String(index + 1).padStart(2, '0')}</td>
                                <td className="max-w-[200px] truncate px-3 py-2.5 font-semibold text-white">{team.teamName}</td>
                                <td className="px-3 py-2.5 text-center font-bold text-amber-200">{result ? (result.position === 1 ? '01' : '—') : '—'}</td>
                                <td className="px-3 py-2.5 text-center font-semibold text-slate-200">{result ? result.kills : '—'}</td>
                                <td className="px-3 py-2.5 text-center text-indigo-200">{result ? `#${result.position} · ${placementPoints}` : 'Pending'}</td>
                                <td className="px-3 py-2.5 text-right font-black tabular-nums text-cyan-200">{result ? result.points : '—'}</td>
                              </tr>;
                            }) : <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-500">Registered teams will appear here after you choose a tournament.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Unpublished Results — {selectedResultsTournament.name}</div>
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
                                  Map {r.mapNumber || 1} • {r.kills} kills • <span className="text-indigo-300 font-mono">{r.points} pts</span>
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
                </div>
              )}

              {tab === 'results' && showStandingsPreview && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6" onClick={() => setShowStandingsPreview(false)}>
                  <section role="dialog" aria-modal="true" aria-label="Tournament standings preview" onClick={(event) => event.stopPropagation()} className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-lime-300/20 bg-[#032c1b] text-white shadow-[0_24px_100px_rgba(0,0,0,.7)] sm:rounded-3xl">
                    <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-lime-300/10 blur-[100px]" />
                    <div className="relative flex items-start justify-between gap-4 border-b border-lime-200/10 px-4 py-4 sm:px-7 sm:py-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.2em] text-lime-200 sm:text-[10px]"><span className="h-px w-6 bg-lime-300" /> Tournament standings</div>
                        <h2 className="mt-2 truncate text-lg font-black uppercase tracking-wide text-white sm:text-2xl">{previewTournament.name}</h2>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-lime-100/60 sm:text-xs">{previewGroup === 'all' ? 'All groups' : previewGroup} · Match {previewMapNumber}</p>
                      </div>
                      <button type="button" onClick={() => setShowStandingsPreview(false)} aria-label="Close preview" className="shrink-0 rounded-xl border border-white/10 bg-black/20 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
                    </div>
                    <div className="relative min-h-0 flex-1 overflow-auto p-3 sm:p-6">
                      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-lime-100/55">Tournament
                          <select value={previewTournament.id} onChange={(event) => { setPreviewTournamentId(event.target.value); setPreviewGroup('all'); setPreviewMapNumber(1); }} className="mt-1.5 w-full rounded-xl border border-lime-200/15 bg-[#071c12] px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-white outline-none focus:border-lime-300/50">
                            {tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}
                          </select>
                        </label>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-lime-100/55">Group
                          <select value={previewGroup} onChange={(event) => setPreviewGroup(event.target.value)} className="mt-1.5 w-full rounded-xl border border-lime-200/15 bg-[#071c12] px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-white outline-none focus:border-lime-300/50">
                            <option value="all">All groups</option>
                            {previewGroupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
                          </select>
                        </label>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-lime-100/55">Match
                          <select value={previewMapNumber} onChange={(event) => setPreviewMapNumber(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-lime-200/15 bg-[#071c12] px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-white outline-none focus:border-lime-300/50">
                            {previewMapOptions.map((mapNumber) => <option key={mapNumber} value={mapNumber}>Match {mapNumber}</option>)}
                          </select>
                        </label>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-lime-100/55">Point table color
                          <select value={previewTableTheme} onChange={(event) => setPreviewTableTheme(event.target.value as keyof typeof STANDINGS_COLOR_THEMES)} className="mt-1.5 w-full rounded-xl border border-lime-200/15 bg-[#071c12] px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-white outline-none focus:border-lime-300/50">
                            {Object.entries(STANDINGS_COLOR_THEMES).map(([themeKey, theme]) => <option key={themeKey} value={themeKey}>{theme.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-lime-300/15 bg-[#052415] sm:rounded-2xl">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[680px] border-separate border-spacing-y-1.5 px-2 py-2 text-left sm:border-spacing-y-2 sm:px-3 sm:py-3">
                            <thead>
                              <tr className="text-[9px] font-black uppercase tracking-wider text-[#062c1b] sm:text-xs">
                                {['#', '', 'Team name', 'Booyah', 'Kill', 'Pos.', 'Total'].map((heading, headingIndex) => <th key={`${heading}-${headingIndex}`} style={{ backgroundColor: standingsTheme.accent, color: standingsTheme.text }} className={`px-3 py-2.5 first:rounded-l-full last:rounded-r-full sm:px-4 sm:py-3 ${heading === 'Team name' ? 'w-[36%] text-left' : 'text-center'}`}>{heading}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {previewRows.length ? previewRows.map(({ team, result }, index) => (
                                <tr key={team.id} className={`text-xs font-extrabold sm:text-sm ${result?.position === 1 ? 'text-lime-100' : ''}`}>
                                  <td style={{ backgroundColor: standingsTheme.row, color: standingsTheme.soft }} className="rounded-l-full px-3 py-3 text-center tabular-nums sm:px-4">{String(index + 1).padStart(2, '0')}</td>
                                  <td style={{ backgroundColor: standingsTheme.row, borderColor: `${standingsTheme.soft}33` }} className="border-y px-2 py-2 text-center"><span className="mx-auto flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border bg-black/25 text-[9px] font-black" style={{ borderColor: `${standingsTheme.soft}33`, color: standingsTheme.soft }}>{team.teamLogo ? <img src={team.teamLogo} alt="" className="h-full w-full object-cover" /> : team.teamName.trim().slice(0, 2).toUpperCase()}</span></td>
                                  <td style={{ backgroundColor: standingsTheme.row }} className="px-3 py-3 text-white sm:px-4">{team.teamName}</td>
                                  <td style={{ backgroundColor: standingsTheme.soft, color: standingsTheme.text }} className="px-3 py-3 text-center tabular-nums">{result ? (result.position === 1 ? '01' : '—') : '—'}</td>
                                  <td style={{ backgroundColor: standingsTheme.row }} className="px-3 py-3 text-center tabular-nums text-white">{result ? result.kills : '—'}</td>
                                  <td style={{ backgroundColor: standingsTheme.soft, color: standingsTheme.text }} className="px-3 py-3 text-center tabular-nums">{result ? calcPoints(result.position, 0) : '—'}</td>
                                  <td style={{ backgroundColor: standingsTheme.row, color: standingsTheme.soft }} className="rounded-r-full px-3 py-3 text-center tabular-nums sm:px-4">{result ? result.points : '—'}</td>
                                </tr>
                              )) : <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-lime-100/55">No approved teams registered for this group yet.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <p className="mt-3 text-right text-[9px] font-bold uppercase tracking-[.16em] text-lime-100/35">Preview only · not published</p>
                    </div>
                  </section>
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
                          {placements.length ? <div className="divide-y divide-white/[.05]">{placements.map((result) => <div key={result.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><div className="flex min-w-0 items-center gap-3"><span className={`w-8 text-center text-xs font-black ${result.position === 1 ? 'text-amber-200' : 'text-slate-400'}`}>{result.position === 1 ? <Crown size={15} className="mx-auto" /> : `#${result.position}`}</span><span className="truncate text-xs font-bold text-white">{result.teamName}</span></div><div className="flex shrink-0 items-center gap-3 text-[10px] text-slate-400"><span>Map {result.mapNumber || 1}</span><span>{result.kills} kills</span><span>{result.points} pts</span>{(result.earnings || 0) > 0 && <span className="font-bold text-emerald-300">৳{Number(result.earnings).toLocaleString()}</span>}</div></div>)}</div> : <div className="px-4 py-5 text-xs text-slate-500">No published placements were recorded for this tournament.</div>}
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
                      {tourGroupsEnabled && !tourUnlimitedGroups ? <><label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Group Capacity</label><div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.04] px-3.5 py-2 text-sm font-mono text-cyan-100">{tourGroupCount * tourTeamsPerGroup} teams total</div></> : tourUnlimitedGroups || tourUnlimitedTeams ? <><label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Capacity</label><div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.04] px-3.5 py-2 text-sm text-emerald-100">{tourUnlimitedGroups ? 'Unlimited groups' : 'Unlimited teams'}</div></> : <><label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Max Teams (Capacity)</label><input type="number" min="1" max="10000" value={tourMaxTeams} onChange={(e) => setTourMaxTeams(Math.max(1, Number(e.target.value) || 1))} className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"/> </>}
                    </div>

                    <div className="col-span-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-200"><input type="checkbox" checked={tourGroupsEnabled && !tourUnlimitedGroups} onChange={(event) => { setTourGroupsEnabled(event.target.checked); setTourUnlimitedGroups(false); setTourUnlimitedTeams(false); }} className="accent-indigo-500"/> Enable automatic groups</label>
                      {tourGroupsEnabled && !tourUnlimitedGroups && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-[10px] text-gray-400">Number of groups<input type="number" min="1" max="500" value={tourGroupCount} onChange={(event) => setTourGroupCount(Math.min(500, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-[#2a2b36] bg-[#0b0c10] px-3 py-2 text-sm text-white"/></label><label className="text-[10px] text-gray-400">Teams per group<input type="number" min="1" max="500" value={tourTeamsPerGroup} onChange={(event) => setTourTeamsPerGroup(Math.min(500, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-[#2a2b36] bg-[#0b0c10] px-3 py-2 text-sm text-white"/></label><p className="col-span-2 text-[10px] text-cyan-200">Capacity: {tourGroupCount * tourTeamsPerGroup} teams · registrations close automatically when full.</p></div>}
                      <label className="mt-2 flex items-center gap-2 text-[10px] text-gray-300"><input type="checkbox" checked={tourUnlimitedGroups} onChange={(event) => { setTourUnlimitedGroups(event.target.checked); setTourGroupsEnabled(event.target.checked); setTourUnlimitedTeams(event.target.checked); }} className="accent-emerald-500"/> Unlimited groups (registration closes manually)</label>
                      {tourUnlimitedGroups && <div className="mt-3"><label className="text-[10px] text-gray-400">Teams per group<input type="number" min="1" max="500" value={tourTeamsPerGroup} onChange={(event) => setTourTeamsPerGroup(Math.min(500, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-[#2a2b36] bg-[#0b0c10] px-3 py-2 text-sm text-white"/></label><p className="mt-1 text-[10px] text-cyan-200">Unlimited groups · {tourTeamsPerGroup} teams per group.</p></div>}
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

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-gray-400">Prize Pool<input type="text" maxLength={60} value={tourPrizePool} onChange={(event) => setTourPrizePool(event.target.value)} placeholder="e.g. ৳10,000" className="mt-1 w-full rounded-xl border border-[#2a2b36] bg-[#0b0c10] px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-300/40"/></label>
                    <label className="block text-xs font-semibold text-gray-400">Room ID<input type="text" maxLength={40} value={tourRoomId} onChange={(event) => setTourRoomId(event.target.value)} placeholder="Enter room ID (optional)" className="mt-1 w-full rounded-xl border border-[#2a2b36] bg-[#0b0c10] px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"/></label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                      Square Card Background Image URL
                    </label>
                    <input
                      type="url"
                      value={tourCardImage}
                      onChange={(e) => { setTourCardImage(e.target.value); setTourCardImageName(''); }}
                      placeholder="https://example.com/tournament-art.jpg"
                      className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <label className="mt-2 flex cursor-pointer flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[.025] px-3 py-2.5 text-[11px] text-slate-300 hover:border-indigo-300/30 hover:bg-indigo-300/[.04]">
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={tourImageUploading} onChange={(event) => { void handleTournamentImageUpload(event.target.files?.[0], 'edit'); event.currentTarget.value = ''; }} />
                      <span className="rounded-lg bg-indigo-500/15 px-2.5 py-1.5 font-bold text-indigo-200">{tourImageUploading ? 'Preparing image…' : 'Upload image'}</span>
                      <span className="min-w-0 flex-1 truncate">{tourCardImageName || 'PNG, JPG, or WebP · up to 8 MB'}</span>
                    </label>
                    {tourCardImage && <img src={tourCardImage} alt="Tournament card preview" className="mt-2 h-24 w-24 rounded-xl border border-white/10 object-cover" />}
                    <p className="text-[11px] text-gray-500 mt-1">Uploaded images are optimized and saved with this tournament. Leave blank to use the built-in artwork.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={tourImageUploading}
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

              {/* TAB 5: DISCORD EVENT LOGS */}
              {tab === 'discord' && (
                <div className="space-y-4">
                  <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-indigo-200">Secure webhook routing</div><h3 className="mt-1 text-lg font-extrabold text-white">Discord Event Logs</h3><p className="mt-1 text-xs text-slate-400">Event channels are configured server-side; webhook URLs are never shown in the app.</p></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ['Tournament created', 'Create log channel'],
                      ['Tournament deleted', 'Delete log channel'],
                      ['Squad account created', 'Squad registration log channel'],
                      ['Scrim team registered', 'Tournament registration log channel'],
                      ['Wallet top-up requested / credited', 'Add money log channel'],
                      ['Paid entry fee deducted', 'Tournament fee log channel'],
                    ].map(([event, channel], index) => <div key={event} className="wallet-card flex items-center gap-3 rounded-xl border border-white/[.07] bg-[#151720] p-3" style={{ animationDelay: `${index * 45}ms` }}><CheckCircle2 size={16} className="shrink-0 text-emerald-300"/><div><div className="text-xs font-bold text-white">{event}</div><div className="mt-1 text-[10px] text-slate-500">{channel}</div></div></div>)}
                  </div>
                </div>
              )}

              {/* TAB 6: AUDIT REGISTRATION LOGS */}
              {tab === 'logs' && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-400">
                    Team registration, Discord delivery, tournament changes, team moderation, match results, and admin actions:
                  </div>

                  {logsError && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3 text-xs text-rose-200">Registration logs could not load: {logsError}</div>}

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
                            {log.whatsappNumber && <div className="mt-1 text-gray-400">WhatsApp: <a className="text-emerald-300 hover:underline" href={`https://wa.me/${log.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{log.whatsappNumber}</a></div>}
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
                <div className="rounded-xl border border-white/[.08] bg-white/[.025] p-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-200"><input type="checkbox" checked={newTourGroupsEnabled && !newTourUnlimitedGroups} onChange={(event) => { setNewTourGroupsEnabled(event.target.checked); setNewTourUnlimitedGroups(false); setNewTourUnlimitedTeams(false); }} className="accent-indigo-500"/> Enable automatic groups</label>
                  {newTourGroupsEnabled && !newTourUnlimitedGroups && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-[10px] text-gray-400">Number of groups<input type="number" min="1" max="500" value={newTourGroupCount} onChange={(event) => setNewTourGroupCount(Math.min(500, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-[#2a2b36] bg-[#0b0c10] px-3 py-2 text-xs text-white"/></label><label className="text-[10px] text-gray-400">Teams per group<input type="number" min="1" max="500" value={newTourTeamsPerGroup} onChange={(event) => setNewTourTeamsPerGroup(Math.min(500, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-[#2a2b36] bg-[#0b0c10] px-3 py-2 text-xs text-white"/></label><p className="col-span-2 text-[10px] text-cyan-200">Total capacity: {newTourGroupCount * newTourTeamsPerGroup} teams; registration closes when all groups fill.</p></div>}
                  <label className="mt-3 flex items-center gap-2 text-[10px] text-gray-300"><input type="checkbox" checked={newTourUnlimitedGroups} onChange={(event) => { setNewTourUnlimitedGroups(event.target.checked); setNewTourGroupsEnabled(event.target.checked); setNewTourUnlimitedTeams(event.target.checked); }} className="accent-emerald-500"/> Unlimited groups (registration closes manually)</label>
                  {newTourUnlimitedGroups && <div className="mt-3"><label className="text-[10px] text-gray-400">Teams per group<input type="number" min="1" max="500" value={newTourTeamsPerGroup} onChange={(event) => setNewTourTeamsPerGroup(Math.min(500, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-[#2a2b36] bg-[#0b0c10] px-3 py-2 text-xs text-white"/></label><p className="mt-1 text-[10px] text-cyan-200">Unlimited groups · {newTourTeamsPerGroup} teams per group.</p></div>}
                  {!newTourGroupsEnabled && !newTourUnlimitedGroups && <label className="mt-3 block text-xs text-gray-400">Max Teams<input type="number" min="1" max="10000" value={newTourMax} onChange={(event) => setNewTourMax(Math.max(1, Number(event.target.value) || 1))} className="mt-1 w-full rounded-lg border border-[#2a2b36] bg-[#0b0c10] px-3 py-2 text-xs text-white"/></label>}
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-gray-400">Prize Pool<input type="text" maxLength={60} value={newTourPrizePool} onChange={(event) => setNewTourPrizePool(event.target.value)} placeholder="e.g. ৳10,000" className="mt-1 w-full rounded-xl border border-[#2a2b36] bg-[#0b0c10] px-3 py-2.5 text-xs text-white outline-none focus:border-amber-300/40"/></label>
                  <label className="block text-xs text-gray-400">Room ID<input type="text" maxLength={40} value={newTourRoomId} onChange={(event) => setNewTourRoomId(event.target.value)} placeholder="Optional" className="mt-1 w-full rounded-xl border border-[#2a2b36] bg-[#0b0c10] px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-300/40"/></label>
                </div>

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
                    onChange={(e) => { setNewTourCardImage(e.target.value); setNewTourCardImageName(''); }}
                    className="w-full bg-[#0b0c10] border border-[#2a2b36] rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <label className="mt-2 flex cursor-pointer flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[.025] px-3 py-2.5 text-[11px] text-slate-300 hover:border-indigo-300/30 hover:bg-indigo-300/[.04]">
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={newTourImageUploading} onChange={(event) => { void handleTournamentImageUpload(event.target.files?.[0], 'create'); event.currentTarget.value = ''; }} />
                    <span className="rounded-lg bg-indigo-500/15 px-2.5 py-1.5 font-bold text-indigo-200">{newTourImageUploading ? 'Preparing image…' : 'Upload image'}</span>
                    <span className="min-w-0 flex-1 truncate">{newTourCardImageName || 'PNG, JPG, or WebP · up to 8 MB'}</span>
                  </label>
                  {newTourCardImage && <img src={newTourCardImage} alt="Tournament card preview" className="mt-2 h-24 w-24 rounded-xl border border-white/10 object-cover" />}
                  <p className="text-[10px] text-gray-500 mt-1">Optional. Uploaded images are optimized and saved with the tournament. Leave blank for default artwork.</p>
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
                    disabled={newTourImageUploading}
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
