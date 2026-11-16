import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
} from 'firebase/firestore';
import {
  BookOpen,
  CalendarClock,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  LogOut,
  Menu,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Timer,
  X,
} from 'lucide-react';
import { SUBJECTS } from './constants';
import {
  PomodoroPhase,
  PomodoroPresetId,
  ProgressState,
  SharedProgressDocument,
  SharedSubjectSummary,
  StudySessionLog,
  SubjectCode,
  TimerMode,
} from './types';
import SubjectCard from './components/SubjectCard';
import AnalyticsInspector from './components/AnalyticsInspector';
import StudyTimerCalendarView, {
  formatClockDigits,
  formatDurationHuman,
  getLocalDateString,
} from './components/StudyTimerCalendarView';
import ShareWithParentsModal from './components/ShareWithParentsModal';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const isDummyConfig = firebaseConfig.apiKey === 'DUMMY_API_KEY';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = isDummyConfig ? null : getFirestore(app, firebaseConfig.firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Generate a cryptographically random 24-character alphanumeric token
function generateRandomShareToken(length = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

// Build strictly anonymous SharedProgressDocument (Zero PII / Zero Email)
function buildSharedProgressPayload(
  ownerId: string,
  progressState: ProgressState,
  logs: StudySessionLog[]
): SharedProgressDocument {
  let doneChapters = 0;
  let totalChapters = 0;
  let totalEarnedMarks = 0;
  let totalAllMarks = 0;
  const subjectProgress: Record<string, SharedSubjectSummary> = {};

  SUBJECTS.forEach((subj) => {
    let sDone = 0;
    let sTotal = 0;
    let sEarnedMarks = 0;
    let sTotalMarks = 0;

    subj.data.forEach((unit) => {
      const unitTotal = unit.chapters.length;
      let unitDone = 0;
      unit.chapters.forEach((ch) => {
        sTotal++;
        const k = `${subj.id}__${ch.trim().replace(/\s+/g, '_')}`;
        if (progressState[k]) {
          sDone++;
          unitDone++;
        }
      });
      const m = unit.marks || 0;
      sTotalMarks += m;
      if (unitTotal > 0) {
        sEarnedMarks += (unitDone / unitTotal) * m;
      }
    });

    const sPct = sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0;
    subjectProgress[subj.id] = {
      done: sDone,
      total: sTotal,
      pct: sPct,
      earnedMarks: Math.round(sEarnedMarks),
      totalMarks: sTotalMarks,
    };

    doneChapters += sDone;
    totalChapters += sTotal;
    totalEarnedMarks += Math.round(sEarnedMarks);
    totalAllMarks += sTotalMarks;
  });

  const dailyStudyMinutes: Record<string, number> = {};
  const dailySecondsAccumulator: Record<string, number> = {};
  const sanitizedLogs: StudySessionLog[] = logs.slice(-2000).map((l) => {
    dailySecondsAccumulator[l.date] = (dailySecondsAccumulator[l.date] || 0) + l.durationSeconds;
    const cleanLog: StudySessionLog = {
      id: String(l.id),
      date: String(l.date),
      subjectId: l.subjectId,
      durationSeconds: Number(l.durationSeconds) || 0,
      mode: l.mode,
      completedAt: String(l.completedAt),
    };
    if (l.chapter) {
      cleanLog.chapter = String(l.chapter);
    }
    return cleanLog;
  });

  Object.entries(dailySecondsAccumulator).forEach(([dateKey, secs]) => {
    dailyStudyMinutes[dateKey] = Math.round(secs / 60);
  });

  return {
    ownerId,
    updatedAt: new Date().toISOString(),
    overallReadiness: {
      doneChapters,
      totalChapters,
      pct: totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0,
      earnedMarks: totalEarnedMarks,
      totalMarks: totalAllMarks,
    },
    subjectProgress,
    dailyStudyMinutes,
    state: progressState,
    studyLogs: sanitizedLogs,
  };
}

// Gentle Web Audio completion chime (no external audio files required)
function playCompletionChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.14);
      osc.stop(ctx.currentTime + i * 0.14 + 0.45);
    });
  } catch {
    // Ignore audio context restrictions
  }
}

function getPresetDurations(
  preset: PomodoroPresetId,
  customFocus: number,
  customBreak: number
): { focus: number; shortBreak: number; longBreak: number } {
  switch (preset) {
    case '25-5':
      return { focus: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };
    case '50-10':
      return { focus: 50 * 60, shortBreak: 10 * 60, longBreak: 20 * 60 };
    case '90-15':
      return { focus: 90 * 60, shortBreak: 15 * 60, longBreak: 30 * 60 };
    case 'custom':
      return {
        focus: Math.max(1, customFocus) * 60,
        shortBreak: Math.max(1, customBreak) * 60,
        longBreak: Math.max(5, customBreak * 2) * 60,
      };
  }
}

export default function App() {
  // Detect /parent/[token] route
  const parentRouteToken = useMemo(() => {
    const match = window.location.pathname.match(/^\/parent\/([a-zA-Z0-9_-]+)\/?$/);
    if (match && match[1]) return match[1];
    const params = new URLSearchParams(window.location.search);
    return params.get('parent');
  }, []);

  const isParentView = Boolean(parentRouteToken);

  const [workspaceView, setWorkspaceView] = useState<'curriculum' | 'timer_calendar'>('curriculum');
  const [activeTab, setActiveTab] = useState<SubjectCode>('phy');

  const [progress, setProgress] = useState<ProgressState>(() => {
    if (isParentView) return {};
    try {
      const saved = localStorage.getItem('upboard_progress');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [studyLogs, setStudyLogs] = useState<StudySessionLog[]>(() => {
    if (isParentView) return [];
    try {
      const saved = localStorage.getItem('upboard_study_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Student's active Parent Share Token
  const [parentShareToken, setParentShareToken] = useState<string | null>(() => {
    if (isParentView) return null;
    return localStorage.getItem('upboard_parent_token') || null;
  });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isUpdatingShareLink, setIsUpdatingShareLink] = useState(false);

  // Parent View Loading / Not Found State
  const [parentViewLoading, setParentViewLoading] = useState<boolean>(isParentView);
  const [parentViewNotFound, setParentViewNotFound] = useState<boolean>(false);
  const [parentLastUpdated, setParentLastUpdated] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(isDummyConfig || isParentView);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    status: 'synced' | 'syncing' | 'connecting' | 'error';
    text: string;
  }>({
    status: isDummyConfig ? 'synced' : 'connecting',
    text: isDummyConfig ? 'Local Workspace' : 'Connecting...',
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('upboard_darkmode');
    if (saved !== null) return JSON.parse(saved);
    return false;
  });

  // Workspace UI Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [branchFilter, setBranchFilter] = useState<'all' | 'Physical' | 'Inorganic' | 'Organic'>('all');
  const [collapsedUnits, setCollapsedUnits] = useState<Record<string, boolean>>({});
  const [highlightedUnit, setHighlightedUnit] = useState<number | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [confirmResetSubject, setConfirmResetSubject] = useState(false);

  // Persistent Drift-Free Timer Engine State
  const [timerMode, setTimerMode] = useState<TimerMode>('pomodoro');
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('focus');
  const [presetId, setPresetId] = useState<PomodoroPresetId>('25-5');
  const [customFocusMins, setCustomFocusMins] = useState<number>(25);
  const [customBreakMins, setCustomBreakMins] = useState<number>(5);
  const [timerSubject, setTimerSubject] = useState<SubjectCode>('phy');
  const [timerChapter, setTimerChapter] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState<number>(0);
  const [runStartedAtMs, setRunStartedAtMs] = useState<number | null>(null);
  const [tickNowMs, setTickNowMs] = useState<number>(() => Date.now());

  const durations = useMemo(
    () => getPresetDurations(presetId, customFocusMins, customBreakMins),
    [presetId, customFocusMins, customBreakMins]
  );

  const targetSeconds = useMemo(() => {
    if (timerMode === 'stopwatch') return 0;
    return durations[pomodoroPhase];
  }, [timerMode, durations, pomodoroPhase]);

  const totalElapsedSeconds = useMemo(() => {
    if (!isRunning || !runStartedAtMs) return accumulatedSeconds;
    const delta = Math.max(0, Math.floor((tickNowMs - runStartedAtMs) / 1000));
    return accumulatedSeconds + delta;
  }, [isRunning, runStartedAtMs, tickNowMs, accumulatedSeconds]);

  const displaySeconds = useMemo(() => {
    if (timerMode === 'stopwatch') {
      return totalElapsedSeconds;
    }
    return Math.max(0, targetSeconds - totalElapsedSeconds);
  }, [timerMode, totalElapsedSeconds, targetSeconds]);

  const elapsedFocusSeconds = useMemo(() => {
    if (timerMode === 'pomodoro' && pomodoroPhase !== 'focus') return 0;
    return totalElapsedSeconds;
  }, [timerMode, pomodoroPhase, totalElapsedSeconds]);

  // Keep latest state refs for cloud sync inside timer completion callbacks
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const studyLogsRef = useRef(studyLogs);
  studyLogsRef.current = studyLogs;
  const parentShareTokenRef = useRef(parentShareToken);
  parentShareTokenRef.current = parentShareToken;

  // Sync dark mode class with documentElement
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('upboard_darkmode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Validate connection to Firestore on boot
  useEffect(() => {
    if (isDummyConfig || !db) return;
    async function testConnection() {
      try {
        await getDocFromServer(doc(db!, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    }
    testConnection();
  }, []);

  const [avatarImgError, setAvatarImgError] = useState(false);

  // Initialize Auth (for student workspace)
  useEffect(() => {
    if (isDummyConfig || isParentView) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAvatarImgError(false);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [isParentView]);

  // Subscribe to /shared_progress/{token} when in Parent View (no login required)
  useEffect(() => {
    if (!isParentView || !parentRouteToken) return;

    if (isDummyConfig || !db) {
      // LocalStorage fallback when running in local/dummy Firebase config
      const savedShared = localStorage.getItem(`upboard_shared_${parentRouteToken}`);
      if (savedShared) {
        try {
          const parsed = JSON.parse(savedShared) as SharedProgressDocument;
          setProgress(parsed.state || {});
          setStudyLogs(Array.isArray(parsed.studyLogs) ? parsed.studyLogs : []);
          setParentLastUpdated(parsed.updatedAt || null);
          setParentViewNotFound(false);
        } catch {
          setParentViewNotFound(true);
        }
      } else {
        setParentViewNotFound(true);
      }
      setParentViewLoading(false);
      return;
    }

    setParentViewLoading(true);
    const sharedPath = `shared_progress/${parentRouteToken}`;
    const sharedRef = doc(db, 'shared_progress', parentRouteToken);

    const unsubscribe = onSnapshot(
      sharedRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SharedProgressDocument;
          setProgress(data.state || {});
          setStudyLogs(Array.isArray(data.studyLogs) ? data.studyLogs : []);
          setParentLastUpdated(data.updatedAt || null);
          setParentViewNotFound(false);
        } else {
          setParentViewNotFound(true);
        }
        setParentViewLoading(false);
      },
      (error) => {
        logFirestoreError(error, OperationType.GET, sharedPath);
        setParentViewNotFound(true);
        setParentViewLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isParentView, parentRouteToken]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      console.error('Error signing in with Google:', error);
      const errObj = error as { code?: string; message?: string };
      if (errObj.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completing. Please try again.');
      } else {
        setAuthError(errObj.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Sync student's private workspace (`state`, `studyLogs`, `parentShareToken`) with Firestore
  useEffect(() => {
    if (isDummyConfig || isParentView || !user || !isAuthReady || !db) return;

    setSyncStatus({ status: 'syncing', text: 'Syncing...' });
    const docPath = `artifacts/upboard-checklist/users/${user.uid}/progress/upboard_5subj_tasks`;
    const docRef = doc(
      db,
      'artifacts',
      'upboard-checklist',
      'users',
      user.uid,
      'progress',
      'upboard_5subj_tasks'
    );

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.state) {
            setProgress(data.state);
            localStorage.setItem('upboard_progress', JSON.stringify(data.state));
          }
          if (Array.isArray(data.studyLogs)) {
            setStudyLogs(data.studyLogs);
            localStorage.setItem('upboard_study_logs', JSON.stringify(data.studyLogs));
          }
          if (typeof data.parentShareToken === 'string' && data.parentShareToken) {
            setParentShareToken(data.parentShareToken);
            localStorage.setItem('upboard_parent_token', data.parentShareToken);
          }
          setSyncStatus({
            status: 'synced',
            text: `Synced · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          });
        } else {
          setSyncStatus({ status: 'synced', text: 'Cloud Ready' });
        }
      },
      (error) => {
        logFirestoreError(error, OperationType.GET, docPath);
        setSyncStatus({ status: 'error', text: 'Sync failed' });
      }
    );

    return () => unsubscribe();
  }, [user, isAuthReady, isParentView]);

  // Background sync helper for shared_progress/{token}
  const syncSharedProgressInBackground = useCallback(
    async (
      activeToken: string | null,
      newProgress: ProgressState,
      newLogs: StudySessionLog[]
    ) => {
      if (!activeToken || isParentView) return;
      const ownerUid = user?.uid || 'local-user';
      const payload = buildSharedProgressPayload(ownerUid, newProgress, newLogs);

      localStorage.setItem(`upboard_shared_${activeToken}`, JSON.stringify(payload));

      if (isDummyConfig || !user || !isAuthReady || !db) return;
      const sharedPath = `shared_progress/${activeToken}`;
      try {
        await setDoc(doc(db, 'shared_progress', activeToken), payload);
      } catch (e) {
        logFirestoreError(e, OperationType.WRITE, sharedPath);
      }
    },
    [user, isAuthReady, isParentView]
  );

  // Ensure existing parentShareToken document stays synced when student opens the app
  useEffect(() => {
    if (isParentView || !parentShareToken) return;
    if (!isDummyConfig && (!user || !isAuthReady)) return;
    syncSharedProgressInBackground(parentShareToken, progress, studyLogs);
  }, [parentShareToken, user, isAuthReady, isParentView]);

  const saveWorkspaceToCloud = useCallback(
    async (
      newProgress: ProgressState,
      newLogs: StudySessionLog[],
      overrideShareToken?: string | null
    ) => {
      if (isParentView) return;
      const tokenToUse =
        overrideShareToken !== undefined ? overrideShareToken : parentShareTokenRef.current;

      localStorage.setItem('upboard_progress', JSON.stringify(newProgress));
      localStorage.setItem('upboard_study_logs', JSON.stringify(newLogs));

      const sanitizedLogs: StudySessionLog[] = newLogs.map((l) => ({
        id: String(l.id),
        date: String(l.date),
        subjectId: l.subjectId,
        durationSeconds: Math.max(1, Math.round(Number(l.durationSeconds) || 0)),
        mode: l.mode,
        completedAt: String(l.completedAt),
        ...(l.chapter ? { chapter: String(l.chapter) } : {}),
      }));

      // Automatically update shared_progress/{token} in the background if a parent link exists
      if (tokenToUse) {
        syncSharedProgressInBackground(tokenToUse, newProgress, sanitizedLogs);
      }

      if (isDummyConfig) {
        setSyncStatus({
          status: 'synced',
          text: `Saved · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        });
        return;
      }
      if (!user || !isAuthReady || !db) return;
      setSyncStatus({ status: 'syncing', text: 'Saving...' });
      const docPath = `artifacts/upboard-checklist/users/${user.uid}/progress/upboard_5subj_tasks`;
      try {
        const docRef = doc(
          db,
          'artifacts',
          'upboard-checklist',
          'users',
          user.uid,
          'progress',
          'upboard_5subj_tasks'
        );
        await setDoc(
          docRef,
          {
            state: newProgress,
            studyLogs: sanitizedLogs,
            ...(tokenToUse ? { parentShareToken: tokenToUse } : {}),
          },
          { merge: true }
        );
        setSyncStatus({
          status: 'synced',
          text: `Synced · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        });
      } catch (e) {
        logFirestoreError(e, OperationType.WRITE, docPath);
        setSyncStatus({ status: 'error', text: 'Save error' });
      }
    },
    [user, isAuthReady, isParentView, syncSharedProgressInBackground]
  );

  // Generate a new secret parent link or reset/delete the existing one
  const handleGenerateOrResetParentLink = useCallback(async () => {
    if (isParentView || isUpdatingShareLink) return;
    setIsUpdatingShareLink(true);
    const oldToken = parentShareTokenRef.current;
    const newToken = generateRandomShareToken(24);

    try {
      // 1. Delete old shared_progress document so the old link immediately stops working
      if (oldToken) {
        localStorage.removeItem(`upboard_shared_${oldToken}`);
        if (!isDummyConfig && user && db) {
          const oldPath = `shared_progress/${oldToken}`;
          try {
            await deleteDoc(doc(db, 'shared_progress', oldToken));
          } catch (e) {
            logFirestoreError(e, OperationType.DELETE, oldPath);
          }
        }
      }

      // 2. Save new token and create new shared_progress/{newToken} document
      setParentShareToken(newToken);
      parentShareTokenRef.current = newToken;
      localStorage.setItem('upboard_parent_token', newToken);

      await syncSharedProgressInBackground(newToken, progressRef.current, studyLogsRef.current);
      await saveWorkspaceToCloud(progressRef.current, studyLogsRef.current, newToken);
    } finally {
      setIsUpdatingShareLink(false);
    }
  }, [isParentView, isUpdatingShareLink, user, syncSharedProgressInBackground, saveWorkspaceToCloud]);

  // Automatically generate initial token when student opens "Share with Parents" modal for the first time
  const handleOpenShareModal = () => {
    setIsShareModalOpen(true);
    if (!parentShareToken && !isUpdatingShareLink) {
      handleGenerateOrResetParentLink();
    }
  };

  const appendStudyLog = useCallback(
    (entry: Omit<StudySessionLog, 'id' | 'completedAt'>) => {
      if (isParentView) return;
      const newLog: StudySessionLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: entry.date,
        subjectId: entry.subjectId,
        durationSeconds: Math.max(1, Math.round(entry.durationSeconds)),
        mode: entry.mode,
        completedAt: new Date().toISOString(),
        ...(entry.chapter ? { chapter: entry.chapter } : {}),
      };
      const updated = [...studyLogsRef.current, newLog];
      setStudyLogs(updated);
      saveWorkspaceToCloud(progressRef.current, updated);
    },
    [saveWorkspaceToCloud, isParentView]
  );

  const handleDeleteStudyLog = useCallback(
    (id: string) => {
      if (isParentView) return;
      const updated = studyLogsRef.current.filter((l) => l.id !== id);
      setStudyLogs(updated);
      saveWorkspaceToCloud(progressRef.current, updated);
    },
    [saveWorkspaceToCloud, isParentView]
  );

  // Wall-clock 250ms tick interval for drift-free Pomodoro & Stopwatch tracking
  useEffect(() => {
    if (!isRunning || isParentView) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setTickNowMs(now);
    }, 250);
    return () => clearInterval(interval);
  }, [isRunning, isParentView]);

  // Detect automatic Pomodoro countdown completion
  useEffect(() => {
    if (!isRunning || timerMode !== 'pomodoro' || isParentView) return;
    if (totalElapsedSeconds >= targetSeconds && targetSeconds > 0) {
      playCompletionChime();
      setIsRunning(false);
      setRunStartedAtMs(null);
      setAccumulatedSeconds(0);

      if (pomodoroPhase === 'focus') {
        appendStudyLog({
          date: getLocalDateString(),
          subjectId: timerSubject,
          ...(timerChapter ? { chapter: timerChapter } : {}),
          durationSeconds: targetSeconds,
          mode: 'pomodoro',
        });
        setPomodoroPhase('shortBreak');
      } else {
        setPomodoroPhase('focus');
      }
    }
  }, [
    isRunning,
    timerMode,
    totalElapsedSeconds,
    targetSeconds,
    pomodoroPhase,
    timerSubject,
    timerChapter,
    appendStudyLog,
    isParentView,
  ]);

  // Timer Control Handlers
  const handleStartPauseTimer = () => {
    if (isParentView) return;
    if (isRunning) {
      const now = Date.now();
      const delta = runStartedAtMs ? Math.max(0, Math.floor((now - runStartedAtMs) / 1000)) : 0;
      setAccumulatedSeconds((prev) => prev + delta);
      setRunStartedAtMs(null);
      setIsRunning(false);
    } else {
      const now = Date.now();
      setTickNowMs(now);
      setRunStartedAtMs(now);
      setIsRunning(true);
    }
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setRunStartedAtMs(null);
    setAccumulatedSeconds(0);
  };

  const handleFinishAndLogSession = () => {
    if (isParentView) return;
    const durationToLog = elapsedFocusSeconds;
    setIsRunning(false);
    setRunStartedAtMs(null);
    setAccumulatedSeconds(0);

    if (durationToLog >= 1) {
      playCompletionChime();
      appendStudyLog({
        date: getLocalDateString(),
        subjectId: timerSubject,
        ...(timerChapter ? { chapter: timerChapter } : {}),
        durationSeconds: durationToLog,
        mode: timerMode,
      });
    }
  };

  const handleStartChapterFocusFromCard = (subj: SubjectCode, chapter: string) => {
    if (isParentView) return;
    setTimerSubject(subj);
    setTimerChapter(chapter);
    if (timerMode === 'pomodoro' && pomodoroPhase !== 'focus') {
      setPomodoroPhase('focus');
    }
    setAccumulatedSeconds(0);
    const now = Date.now();
    setTickNowMs(now);
    setRunStartedAtMs(now);
    setIsRunning(true);
  };

  // Reset subject-specific filters when changing subject
  const handleSelectSubject = (subjId: SubjectCode) => {
    setWorkspaceView('curriculum');
    setActiveTab(subjId);
    setBranchFilter('all');
    setConfirmResetSubject(false);
    setMobileSidebarOpen(false);
  };

  const handleToggle = (key: string) => {
    if (isParentView) return;
    const newState = { ...progress, [key]: !progress[key] };
    setProgress(newState);
    saveWorkspaceToCloud(newState, studyLogs);
  };

  const handleBulkToggle = (keys: string[], targetState: boolean) => {
    if (isParentView) return;
    const newState = { ...progress };
    keys.forEach((k) => {
      newState[k] = targetState;
    });
    setProgress(newState);
    saveWorkspaceToCloud(newState, studyLogs);
  };

  const getSubjectProgress = useCallback(
    (subjId: string) => {
      const subj = SUBJECTS.find((s) => s.id === subjId);
      if (!subj) return { n: 0, total: 0, pct: 0, earnedMarks: 0, totalMarks: 0 };

      let total = 0;
      let n = 0;
      let totalMarks = 0;
      let earnedMarks = 0;

      subj.data.forEach((d) => {
        const unitTotal = d.chapters.length;
        let unitDone = 0;
        d.chapters.forEach((ch) => {
          total++;
          const k = `${subjId}__${ch.trim().replace(/\s+/g, '_')}`;
          if (progress[k]) {
            n++;
            unitDone++;
          }
        });
        const m = d.marks || 0;
        totalMarks += m;
        if (unitTotal > 0) {
          earnedMarks += (unitDone / unitTotal) * m;
        }
      });

      const pct = total ? Math.round((n / total) * 100) : 0;
      return { n, total, pct, earnedMarks: Math.round(earnedMarks), totalMarks };
    },
    [progress]
  );

  // Global stats across all 5 subjects
  const globalStats = useMemo(() => {
    let doneCh = 0;
    let totalCh = 0;
    let earnedMarks = 0;
    let totalMarks = 0;

    SUBJECTS.forEach((s) => {
      const st = getSubjectProgress(s.id);
      doneCh += st.n;
      totalCh += st.total;
      earnedMarks += st.earnedMarks;
      totalMarks += st.totalMarks;
    });

    const pct = totalCh > 0 ? Math.round((doneCh / totalCh) * 100) : 0;
    return { doneCh, totalCh, pct, earnedMarks, totalMarks };
  }, [getSubjectProgress]);

  // Compute today's total study seconds and per-chapter study seconds
  const { todayStudySeconds, chapterStudySeconds } = useMemo(() => {
    const todayStr = getLocalDateString();
    let todaySec = 0;
    const chapMap: Record<string, number> = {};

    studyLogs.forEach((log) => {
      if (log.date === todayStr) {
        todaySec += log.durationSeconds;
      }
      if (log.chapter) {
        const k = `${log.subjectId}::${log.chapter}`;
        chapMap[k] = (chapMap[k] || 0) + log.durationSeconds;
      }
    });

    return { todayStudySeconds: todaySec, chapterStudySeconds: chapMap };
  }, [studyLogs]);

  const currentSubject = useMemo(
    () => SUBJECTS.find((s) => s.id === activeTab) || SUBJECTS[0],
    [activeTab]
  );

  const currentSubjectStats = useMemo(
    () => getSubjectProgress(activeTab),
    [activeTab, getSubjectProgress]
  );

  const activeAccent = darkMode ? currentSubject.darkAccent : currentSubject.lightAccent;
  const timerSubjConfig = useMemo(
    () => SUBJECTS.find((s) => s.id === timerSubject) || SUBJECTS[0],
    [timerSubject]
  );
  const timerSubjAccent = darkMode ? timerSubjConfig.darkAccent : timerSubjConfig.lightAccent;

  // Compute filtered units and chapters for active subject
  const filteredUnits = useMemo(() => {
    let runningSection = '';
    const q = searchQuery.trim().toLowerCase();

    return currentSubject.data
      .map((unitData, idx) => {
        if (unitData.sec) {
          runningSection = unitData.sec;
        }
        const inheritedSection = runningSection;

        // Check branch filter for Chemistry
        if (activeTab === 'chem' && branchFilter !== 'all' && unitData.branch !== branchFilter) {
          return null;
        }

        const unitTitleMatch =
          (unitData.unit && unitData.unit.toLowerCase().includes(q)) ||
          (unitData.title && unitData.title.toLowerCase().includes(q)) ||
          (inheritedSection && inheritedSection.toLowerCase().includes(q));

        const visibleChapters = unitData.chapters.filter((ch) => {
          const k = `${activeTab}__${ch.trim().replace(/\s+/g, '_')}`;
          const isCompleted = Boolean(progress[k]);

          if (statusFilter === 'completed' && !isCompleted) return false;
          if (statusFilter === 'pending' && isCompleted) return false;

          if (!q) return true;
          return unitTitleMatch || ch.toLowerCase().includes(q);
        });

        if (visibleChapters.length === 0) return null;

        return {
          idx,
          unitData,
          visibleChapters,
          inheritedSection,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [currentSubject, activeTab, branchFilter, statusFilter, searchQuery, progress]);

  // Expand or collapse all units in current subject
  const areAllCurrentCollapsed = useMemo(() => {
    return currentSubject.data.every((_, idx) => Boolean(collapsedUnits[`${activeTab}-${idx}`]));
  }, [currentSubject, activeTab, collapsedUnits]);

  const handleToggleAllUnits = () => {
    const nextState = !areAllCurrentCollapsed;
    const updated = { ...collapsedUnits };
    currentSubject.data.forEach((_, idx) => {
      updated[`${activeTab}-${idx}`] = nextState;
    });
    setCollapsedUnits(updated);
  };

  const handleResetActiveSubject = () => {
    if (isParentView) return;
    const allKeys: string[] = [];
    currentSubject.data.forEach((d) => {
      d.chapters.forEach((ch) => {
        allKeys.push(`${activeTab}__${ch.trim().replace(/\s+/g, '_')}`);
      });
    });
    handleBulkToggle(allKeys, false);
    setConfirmResetSubject(false);
  };

  const handleJumpToUnit = (unitIdx: number) => {
    setWorkspaceView('curriculum');
    if (statusFilter !== 'all' || branchFilter !== 'all' || searchQuery !== '') {
      setStatusFilter('all');
      setBranchFilter('all');
      setSearchQuery('');
    }
    setCollapsedUnits((prev) => ({
      ...prev,
      [`${activeTab}-${unitIdx}`]: false,
    }));
    setHighlightedUnit(unitIdx);
    setMobileSidebarOpen(false);

    setTimeout(() => {
      const el = document.getElementById(`unit-card-${activeTab}-${unitIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);

    setTimeout(() => {
      setHighlightedUnit((prev) => (prev === unitIdx ? null : prev));
    }, 2000);
  };

  // Loading State
  if (!isAuthReady || parentViewLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex flex-col items-center justify-center gap-3 p-6">
        <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-slate-900 dark:border-t-slate-100 rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {isParentView ? 'Loading shared student progress...' : 'Initializing study workspace...'}
        </p>
      </div>
    );
  }

  // Invalid or Reset Parent Link Screen
  if (isParentView && parentViewNotFound) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 md:p-8 text-center space-y-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Parent View Link Inactive
          </h1>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            This shared progress link has been reset by the student or does not exist. Please ask
            for the updated secret link to view live study progress.
          </p>
        </div>
      </div>
    );
  }

  // Academic SaaS Sign-In Gate (only for Student Workspace when Firebase Auth is active)
  if (!isParentView && !isDummyConfig && !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-6 md:p-10">
        {/* Top Bar */}
        <header className="flex items-center justify-between gap-8 max-w-6xl w-full mx-auto">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-display font-bold text-base tracking-tight whitespace-nowrap shrink-0">
              UP Board Class 12
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle color theme"
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>
          </button>
        </header>

        {/* Center Sign-In Card */}
        <main className="max-w-md w-full mx-auto my-12 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 md:p-8">
          <div className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-2">
            Academic Study Workspace · Class XII
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
            Sync your syllabus & daily study calendar
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            Track chapter completion, log Pomodoro & Stopwatch study sessions into your daily
            calendar, and monitor exam mark weightage across all 5 subjects.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-medium text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isSigningIn ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>{isSigningIn ? 'Authenticating...' : 'Continue with Google'}</span>
          </button>

          {authError && (
            <div className="mt-4 p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
              {authError}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">5</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Core Subjects</div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">97</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Chapters & Topics</div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">25/5</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Pomodoro & Logs</div>
            </div>
          </div>
        </main>

        <footer className="max-w-6xl w-full mx-auto text-center text-xs text-slate-400 dark:text-slate-500">
          UP Board Class 12 Curriculum Tracker · Real-Time Cloud Sync
        </footer>
      </div>
    );
  }

  // Sidebar Content (shared between desktop fixed sidebar and mobile drawer)
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div className="p-4 space-y-5 overflow-y-auto">
        {/* Brand Header */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            {!isParentView &&
            (user?.photoURL || user?.providerData?.[0]?.photoURL) &&
            !avatarImgError ? (
              <img
                src={user.photoURL || user.providerData?.[0]?.photoURL || ''}
                alt={user.displayName || user.email || 'User profile'}
                referrerPolicy="no-referrer"
                onError={() => setAvatarImgError(true)}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center font-display font-bold text-xs shrink-0">
                {!isParentView && (user?.displayName || user?.email) ? (
                  (user.displayName || user.email || 'U').trim().charAt(0).toUpperCase()
                ) : (
                  <BookOpen className="w-4 h-4" />
                )}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                UP Board Class 12
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isParentView ? 'Parent View · Live Progress' : 'Academic Workspace'}
              </div>
            </div>
          </div>

          {mobileSidebarOpen && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dedicated Study Calendar & Time Log Tab */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-400 dark:text-slate-500">
            <span>Time & Daily Log</span>
            <span className="font-mono">Today</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setWorkspaceView('timer_calendar');
              setMobileSidebarOpen(false);
            }}
            className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between gap-2 border ${
              workspaceView === 'timer_calendar'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent'
                : 'bg-slate-50/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CalendarClock className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">
                  {isParentView ? 'Study Calendar & Logs' : 'Focus & Study Calendar'}
                </div>
                <div
                  className={`text-[10px] font-mono tabular-nums truncate ${
                    workspaceView === 'timer_calendar'
                      ? 'text-slate-300 dark:text-slate-600'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {isParentView
                    ? 'Daily Study Hours & History'
                    : isRunning
                    ? `Running · ${formatClockDigits(displaySeconds)}`
                    : 'Pomodoro · Stopwatch · Log'}
                </div>
              </div>
            </div>

            <span
              className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
                workspaceView === 'timer_calendar'
                  ? 'text-emerald-300 dark:text-emerald-700'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatDurationHuman(todayStudySeconds)}
            </span>
          </button>
        </div>

        {/* Overall Syllabus Readiness Summary */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-600 dark:text-slate-300">Overall Readiness</span>
            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
              {globalStats.pct}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-slate-900 dark:bg-slate-100 transition-all duration-200 rounded-full"
              style={{ width: `${globalStats.pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>
              {globalStats.doneCh}/{globalStats.totalCh} chapters
            </span>
            <span>·</span>
            <span>
              {globalStats.earnedMarks}/{globalStats.totalMarks}M
            </span>
          </div>
        </div>

        {/* 5 Subjects Navigation */}
        <div>
          <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-medium text-slate-400 dark:text-slate-500">
            <span>Subjects Curriculum</span>
            <span className="font-mono">Completion</span>
          </div>
          <nav className="space-y-1">
            {SUBJECTS.map((s) => {
              const st = getSubjectProgress(s.id);
              const isActive = workspaceView === 'curriculum' && activeTab === s.id;
              const subjAccent = darkMode ? s.darkAccent : s.lightAccent;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSubject(s.id)}
                  className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer group ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-1.5 h-3.5 rounded-sm shrink-0 transition-transform"
                        style={{
                          backgroundColor: subjAccent,
                          opacity: isActive ? 1 : 0.55,
                        }}
                      />
                      <span className="text-xs font-semibold truncate">{s.name}</span>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-medium shrink-0">
                      {st.pct}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pl-3.5">
                    <div className="flex-1 h-1 bg-slate-200/80 dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-200 rounded-full"
                        style={{
                          width: `${st.pct}%`,
                          backgroundColor: subjAccent,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                      {st.n}/{st.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Unit Quick-Jump Outline for Active Subject */}
        <div>
          <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-medium text-slate-400 dark:text-slate-500">
            <span>{currentSubject.name} Units</span>
            <span className="font-mono">Marks</span>
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
            {currentSubject.data.map((d, idx) => {
              const unitKeys = d.chapters.map(
                (ch) => `${activeTab}__${ch.trim().replace(/\s+/g, '_')}`
              );
              const doneCount = unitKeys.filter((k) => Boolean(progress[k])).length;
              const isUnitDone = doneCount === unitKeys.length && unitKeys.length > 0;
              const shortLabel =
                d.title ||
                (d.unit && d.unit.includes(' — ')
                  ? d.unit.split(' — ').slice(1).join(' — ')
                  : d.chapters[0] || d.unit || `Unit ${idx + 1}`);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleJumpToUnit(idx)}
                  className="w-full px-2.5 py-1.5 rounded text-left text-xs flex items-center justify-between gap-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <span
                    className={`truncate ${
                      isUnitDone ? 'line-through text-slate-400 dark:text-slate-500' : ''
                    }`}
                  >
                    {String(idx + 1).padStart(2, '0')}. {shortLabel}
                  </span>
                  {typeof d.marks === 'number' && (
                    <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                      {d.marks}M
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Footer: Parent View • Read-Only Badge OR Student Account & Cloud Sync */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5">
        {isParentView ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Parent View • Read-Only</span>
            </div>
            {parentLastUpdated && (
              <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 truncate">
                Updated{' '}
                {new Date(parentLastUpdated).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    syncStatus.status === 'syncing' || syncStatus.status === 'connecting'
                      ? 'bg-amber-500 animate-pulse'
                      : syncStatus.status === 'synced'
                      ? 'bg-emerald-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {syncStatus.text}
                </span>
              </div>

              {!isDummyConfig && user && (
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  title="Sign Out"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>

            {!isDummyConfig && user?.email && (
              <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate font-mono">
                {user.email}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Desktop Fixed Sidebar (268px) */}
      <aside className="hidden lg:block w-[268px] shrink-0 bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative w-[280px] max-w-[85vw] bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 h-full z-10">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Multi-Pane Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, Actions & Share with Parents + Theme on Right */}
        <header className="sticky top-0 z-30 h-14 px-4 md:px-6 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation sidebar"
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Contextual Breadcrumb */}
            {workspaceView === 'timer_calendar' ? (
              <div className="flex items-center gap-2 text-xs md:text-sm min-w-0">
                <span className="text-slate-400 dark:text-slate-500 hidden sm:inline whitespace-nowrap">
                  {isParentView ? 'Parent View' : 'Workspace'}
                </span>
                <span
                  aria-hidden="true"
                  className="text-slate-300 dark:text-slate-700 hidden sm:inline"
                >
                  /
                </span>
                <span className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {isParentView ? 'Daily Study Calendar & Logs' : 'Focus Timer & Daily Study Calendar'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs md:text-sm min-w-0">
                <span className="text-slate-400 dark:text-slate-500 hidden sm:inline whitespace-nowrap">
                  {isParentView ? 'Parent View' : 'Curriculum'}
                </span>
                <span
                  aria-hidden="true"
                  className="text-slate-300 dark:text-slate-700 hidden sm:inline"
                >
                  /
                </span>
                <span className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {currentSubject.name}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                  {currentSubject.code}
                </span>
              </div>
            )}
          </div>

          {/* Right Workspace Actions + Share with Parents + Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Persistent Mini Header Timer Control (Hidden in Read-Only Parent View) */}
            {!isParentView && (
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 p-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => setWorkspaceView('timer_calendar')}
                  title="Open Focus Timer & Study Calendar"
                  className="px-2 py-0.5 rounded flex items-center gap-1.5 text-xs hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Timer
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: isRunning ? timerSubjAccent : undefined }}
                  />
                  <span className="hidden xl:inline font-medium text-slate-600 dark:text-slate-300 max-w-[120px] truncate">
                    {timerSubjConfig.name}
                    {timerChapter ? ` · ${timerChapter}` : ''}
                  </span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                    {formatClockDigits(displaySeconds)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleStartPauseTimer}
                  aria-label={isRunning ? 'Pause timer' : 'Start timer'}
                  className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  {isRunning ? (
                    <Pause className="w-3 h-3 fill-current" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                </button>

                {elapsedFocusSeconds >= 1 && (
                  <button
                    type="button"
                    onClick={handleFinishAndLogSession}
                    title="Finish & Log Session"
                    className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Check className="w-3 h-3" />
                    <span className="hidden sm:inline">Log</span>
                  </button>
                )}
              </div>
            )}

            {/* Reset Subject Button (Hidden in Read-Only Parent View) */}
            {!isParentView && workspaceView === 'curriculum' && currentSubjectStats.n > 0 && (
              <>
                {confirmResetSubject ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleResetActiveSubject}
                      className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetSubject(false)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResetSubject(true)}
                    className="hidden md:inline-flex px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Reset Subject</span>
                  </button>
                )}
              </>
            )}

            {/* Share with Parents Button (Next to Light/Dark Toggle) */}
            {!isParentView && (
              <button
                type="button"
                onClick={handleOpenShareModal}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Share with Parents</span>
              </button>
            )}

            {/* Light / Dark Theme Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle color theme"
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        {/* Share with Parents Popup Modal */}
        {!isParentView && (
          <ShareWithParentsModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            shareToken={parentShareToken}
            isBusy={isUpdatingShareLink}
            onGenerateOrResetLink={handleGenerateOrResetParentLink}
          />
        )}

        {/* Main Viewport Container */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {workspaceView === 'timer_calendar' ? (
            <StudyTimerCalendarView
              darkMode={darkMode}
              timerMode={timerMode}
              onChangeTimerMode={(mode) => {
                handleResetTimer();
                setTimerMode(mode);
              }}
              pomodoroPhase={pomodoroPhase}
              onChangePomodoroPhase={(phase) => {
                handleResetTimer();
                setPomodoroPhase(phase);
              }}
              presetId={presetId}
              onChangePresetId={(preset) => {
                handleResetTimer();
                setPresetId(preset);
              }}
              customFocusMins={customFocusMins}
              customBreakMins={customBreakMins}
              onChangeCustomTimes={(fMins, bMins) => {
                handleResetTimer();
                setCustomFocusMins(fMins);
                setCustomBreakMins(bMins);
              }}
              selectedSubject={timerSubject}
              onChangeSelectedSubject={(subj) => {
                setTimerSubject(subj);
                setTimerChapter('');
              }}
              selectedChapter={timerChapter}
              onChangeSelectedChapter={setTimerChapter}
              isRunning={isRunning}
              displaySeconds={displaySeconds}
              targetSeconds={targetSeconds}
              elapsedFocusSeconds={elapsedFocusSeconds}
              onStartPause={handleStartPauseTimer}
              onResetTimer={handleResetTimer}
              onFinishAndLog={handleFinishAndLogSession}
              studyLogs={studyLogs}
              onAddManualLog={appendStudyLog}
              onDeleteLog={handleDeleteStudyLog}
              readOnly={isParentView}
            />
          ) : (
            <>
              {/* Subject Header & Telemetry Summary */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
                <div>
                  {/* Unboxed Kicker Metadata */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mb-1">
                    <span>UP Board Class XII</span>
                    <span aria-hidden="true">·</span>
                    <span>{currentSubject.paperType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{currentSubject.data.length} Units</span>
                  </div>

                  <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {currentSubject.name} Curriculum
                  </h1>
                </div>

                {/* Right Quick Telemetry Figures */}
                <div className="flex items-center gap-6 font-mono tabular-nums">
                  <div>
                    <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                      Chapters Completed
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {currentSubjectStats.n}
                      <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                        /{currentSubjectStats.total}
                      </span>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />

                  <div>
                    <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                      Estimated Marks
                    </div>
                    <div className="text-lg font-bold" style={{ color: activeAccent }}>
                      {currentSubjectStats.earnedMarks}
                      <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                        /{currentSubjectStats.totalMarks}M
                      </span>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />

                  <div>
                    <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                      Completion
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {currentSubjectStats.pct}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Workspace Toolbar: Search, Status Segmented Control, Chemistry Branch Filter, Collapse Toggle */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                  {/* Live Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search ${currentSubject.name} chapters or units...`}
                      className="w-full pl-9 pr-8 py-1.5 text-xs md:text-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status Segmented Filter Controls */}
                  <div className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg self-start">
                    {(
                      [
                        { id: 'all', label: `All (${currentSubjectStats.total})` },
                        {
                          id: 'pending',
                          label: `Remaining (${currentSubjectStats.total - currentSubjectStats.n})`,
                        },
                        { id: 'completed', label: `Completed (${currentSubjectStats.n})` },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 font-mono tabular-nums ${
                          statusFilter === tab.id
                            ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Chemistry Branch Filter */}
                  {activeTab === 'chem' && (
                    <div className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg self-start">
                      {(['all', 'Physical', 'Inorganic', 'Organic'] as const).map((branch) => (
                        <button
                          key={branch}
                          type="button"
                          onClick={() => setBranchFilter(branch)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            branchFilter === branch
                              ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {branch === 'all' ? 'All Branches' : branch}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expand / Collapse All Units Control */}
                <button
                  type="button"
                  onClick={handleToggleAllUnits}
                  className="self-start lg:self-auto px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {areAllCurrentCollapsed ? (
                    <>
                      <ChevronsUpDown className="w-3.5 h-3.5" />
                      <span>Expand All Units</span>
                    </>
                  ) : (
                    <>
                      <ChevronsDownUp className="w-3.5 h-3.5" />
                      <span>Collapse All Units</span>
                    </>
                  )}
                </button>
              </div>

              {/* Multi-Pane Grid: Primary Curriculum Grid (8 cols) + Right Analytics Inspector (4 cols) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Primary Curriculum Viewport */}
                <div className="xl:col-span-8 space-y-3">
                  {filteredUnits.length === 0 ? (
                    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                        No matching chapters found
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Try adjusting your search query or switching the completion filter.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setBranchFilter('all');
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    filteredUnits.map(({ idx, unitData, visibleChapters, inheritedSection }) => {
                      const collapseKey = `${activeTab}-${idx}`;
                      const isCollapsed = Boolean(collapsedUnits[collapseKey]);

                      return (
                        <SubjectCard
                          key={collapseKey}
                          id={`unit-card-${activeTab}-${idx}`}
                          unitIndex={idx}
                          subj={activeTab}
                          data={unitData}
                          visibleChapters={visibleChapters}
                          progress={progress}
                          onToggle={handleToggle}
                          onBulkToggle={handleBulkToggle}
                          isCollapsed={isCollapsed}
                          onToggleCollapse={() =>
                            setCollapsedUnits((prev) => ({
                              ...prev,
                              [collapseKey]: !prev[collapseKey],
                            }))
                          }
                          accentColor={activeAccent}
                          isHighlighted={highlightedUnit === idx}
                          inheritedSection={inheritedSection}
                          chapterStudySeconds={chapterStudySeconds}
                          onStartChapterFocus={handleStartChapterFocusFromCard}
                          readOnly={isParentView}
                        />
                      );
                    })
                  )}
                </div>

                {/* Right Analytics & Exam Inspector Pane */}
                <div className="xl:col-span-4 xl:sticky xl:top-20">
                  <AnalyticsInspector
                    subject={currentSubject}
                    progress={progress}
                    accentColor={activeAccent}
                    onJumpToUnit={handleJumpToUnit}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
