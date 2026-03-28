import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Moon, Sun } from 'lucide-react';
import { SUBJECTS } from './constants';
import { SubjectCode, ProgressState } from './types';
import SubjectCard from './components/SubjectCard';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const isDummyConfig = firebaseConfig.apiKey === 'DUMMY_API_KEY';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = isDummyConfig ? null : getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default function App() {
  const [activeTab, setActiveTab] = useState<SubjectCode>('phy');
  const [progress, setProgress] = useState<ProgressState>(() => {
    if (isDummyConfig) {
      const saved = localStorage.getItem('upboard_progress');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(isDummyConfig);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ 
    status: isDummyConfig ? 'synced' : 'connecting', 
    text: isDummyConfig ? 'Local Storage Active' : 'Connecting...' 
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('upboard_darkmode');
    if (saved !== null) return JSON.parse(saved);
    return false;
  });

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('upboard_darkmode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Initialize Auth
  useEffect(() => {
    if (isDummyConfig) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Sign-in popup was closed before completing. Please try again.");
      } else {
        setAuthError(error.message || "Failed to sign in. Please try again.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Sync with Firestore
  useEffect(() => {
    if (isDummyConfig || !user || !isAuthReady || !db) return;

    setSyncStatus({ status: 'syncing', text: 'Loading...' });
    const docRef = doc(db, 'artifacts', 'upboard-checklist', 'users', user.uid, 'progress', 'upboard_5subj_tasks');

    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists() && snap.data().state) {
        setProgress(snap.data().state);
        setSyncStatus({ status: 'synced', text: `Loaded · ${new Date().toLocaleTimeString()}` });
      } else {
        setSyncStatus({ status: 'synced', text: 'Ready to start!' });
      }
    }, (error) => {
      console.error("Snapshot error:", error);
      setSyncStatus({ status: 'error', text: 'Sync failed' });
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const saveToCloud = useCallback(async (newState: ProgressState) => {
    if (isDummyConfig) {
      localStorage.setItem('upboard_progress', JSON.stringify(newState));
      setSyncStatus({ status: 'synced', text: `Saved Locally · ${new Date().toLocaleTimeString()}` });
      return;
    }
    if (!user || !isAuthReady || !db) return;
    setSyncStatus({ status: 'syncing', text: 'Saving...' });
    try {
      const docRef = doc(db, 'artifacts', 'upboard-checklist', 'users', user.uid, 'progress', 'upboard_5subj_tasks');
      await setDoc(docRef, { state: newState }, { merge: true });
      setSyncStatus({ status: 'synced', text: `Saved · ${new Date().toLocaleTimeString()}` });
    } catch (e) {
      console.error("Save error:", e);
      setSyncStatus({ status: 'error', text: 'Save error' });
    }
  }, [user, isAuthReady]);

  const handleToggle = (key: string) => {
    const newState = { ...progress, [key]: !progress[key] };
    setProgress(newState);
    saveToCloud(newState);
  };

  const getSubjectProgress = (subjId: string) => {
    const subj = SUBJECTS.find(s => s.id === subjId);
    if (!subj) return { n: 0, total: 0, pct: 0 };
    
    let total = 0;
    let n = 0;
    subj.data.forEach(d => {
      d.chapters.forEach(ch => {
        total++;
        const k = `${subjId}__${ch.trim().replace(/\s+/g, '_')}`;
        if (progress[k]) n++;
      });
    });
    
    const pct = total ? Math.round((n / total) * 100) : 0;
    return { n, total, pct };
  };

  if (!isAuthReady) {
    return (
      <div className="fixed inset-0 bg-[#f0ece4] dark:bg-[#121212] flex flex-col items-center justify-center z-[999] gap-3">
        <div className="w-8 h-8 border-3 border-[#ddd] dark:border-[#333] border-t-[#555] dark:border-t-[#888] rounded-full animate-spin" />
        <p className="text-sm text-[#777] dark:text-[#a0a0a0]">Loading your progress...</p>
      </div>
    );
  }

  if (!isDummyConfig && !user) {
    return (
      <div className="fixed inset-0 bg-[#f0ece4] dark:bg-[#121212] flex flex-col items-center justify-center z-[999] gap-6 p-4">
        <div className="absolute top-4 right-4">
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            className="p-2 rounded-full bg-white dark:bg-[#1e1e1e] text-[#555] dark:text-[#a0a0a0] shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <div className="text-center">
          <h1 className="main-title text-3xl font-black mb-2 dark:text-[#e0e0e0]">UP Board Class 12</h1>
          <p className="text-[13px] text-[#777] dark:text-[#a0a0a0]">Sign in to sync your progress across devices.</p>
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <button 
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="bg-white dark:bg-[#1e1e1e] text-[#1a1a1a] dark:text-[#e0e0e0] font-bold py-3 px-6 rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] transition-all flex items-center gap-3 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <div className="w-5 h-5 border-2 border-[#ddd] dark:border-[#333] border-t-[#555] dark:border-t-[#888] rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
          
          {authError && (
            <p className="text-xs text-[#ef4444] bg-[#fee2e2] dark:bg-[#451a1a] px-3 py-1.5 rounded-md max-w-xs text-center">
              {authError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 py-5 md:py-10 relative">
      <div className="absolute top-4 right-4 md:top-8 md:right-4">
        <button 
          onClick={() => setDarkMode(!darkMode)} 
          className="p-2 rounded-full bg-white dark:bg-[#1e1e1e] text-[#555] dark:text-[#a0a0a0] shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-colors"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <h1 className="main-title text-3xl font-black text-center mb-1 dark:text-[#e0e0e0]">UP Board Class 12</h1>
      <p className="text-center text-[11px] text-[#777] dark:text-[#a0a0a0] mb-4">Chapter-wise Study Checklist</p>

      <div className="flex items-center justify-center gap-2 mb-4 text-[10px] text-[#888] dark:text-[#a0a0a0]">
        <div className={`w-2 h-2 rounded-full ${syncStatus.status === 'syncing' ? 'bg-[#f59e0b] animate-pulse-sync' : syncStatus.status === 'synced' ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
        <span>{syncStatus.text}</span>
        {!isDummyConfig && user && (
          <button onClick={() => signOut(auth)} className="ml-2 underline hover:text-[#555] dark:hover:text-[#d0d0d0] cursor-pointer">Sign Out</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4 justify-center">
        {SUBJECTS.map(s => {
          const { n, total, pct } = getSubjectProgress(s.id);
          return (
            <div key={s.id} className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] p-2.5 text-center min-w-[90px] transition-colors">
              <div className="text-[9px] font-semibold text-[#aaa] dark:text-[#888] uppercase tracking-wider mb-1">{s.id === 'phy' ? 'Physics' : s.id === 'chem' ? 'Chemistry' : s.id === 'math' ? 'Maths' : s.id === 'eng' ? 'English' : 'Hindi'}</div>
              <div className="text-lg font-bold leading-tight" style={{ color: darkMode && s.id === 'phy' ? '#7dd3fc' : darkMode && s.id === 'chem' ? '#fca5a5' : darkMode && s.id === 'math' ? '#d8b4fe' : darkMode && s.id === 'eng' ? '#5eead4' : darkMode && s.id === 'hin' ? '#fdba74' : s.color }}>{pct}%</div>
              <div className="text-[8px] text-[#aaa] dark:text-[#888]">{n}/{total} done</div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mb-4 justify-center flex-wrap">
        {SUBJECTS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveTab(s.id as SubjectCode)}
            className={`px-4.5 py-2 border-none rounded-full font-semibold text-xs cursor-pointer transition-all ${activeTab === s.id ? 'text-white dark:text-[#121212]' : 'bg-[#e0dbd4] dark:bg-[#2c2c2c] text-[#555] dark:text-[#b0b0b0]'}`}
            style={{ backgroundColor: activeTab === s.id ? (darkMode && s.id === 'phy' ? '#7dd3fc' : darkMode && s.id === 'chem' ? '#fca5a5' : darkMode && s.id === 'math' ? '#d8b4fe' : darkMode && s.id === 'eng' ? '#5eead4' : darkMode && s.id === 'hin' ? '#fdba74' : s.color) : undefined }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {SUBJECTS.find(s => s.id === activeTab)?.data.map((d, idx) => {
            const sColor = SUBJECTS.find(s => s.id === activeTab)?.color;
            const darkColor = activeTab === 'phy' ? '#7dd3fc' : activeTab === 'chem' ? '#fca5a5' : activeTab === 'math' ? '#d8b4fe' : activeTab === 'eng' ? '#5eead4' : '#fdba74';
            const badgeBg = activeTab === 'phy' ? '#dce6f5' : activeTab === 'chem' ? '#f5ddd1' : activeTab === 'math' ? '#ede0f7' : activeTab === 'eng' ? '#ccfbf1' : '#fed7aa';
            const darkBadgeBg = activeTab === 'phy' ? '#0c4a6e' : activeTab === 'chem' ? '#7f1d1d' : activeTab === 'math' ? '#4c1d95' : activeTab === 'eng' ? '#134e4a' : '#7c2d12';
            
            return (
              <div key={idx} style={{ 
                '--subj-color': darkMode ? darkColor : sColor,
                '--subj-badge-bg': darkMode ? darkBadgeBg : badgeBg
              } as React.CSSProperties}>
                <SubjectCard
                  subj={activeTab}
                  data={d}
                  progress={progress}
                  onToggle={handleToggle}
                  subjName={SUBJECTS.find(s => s.id === activeTab)?.label.split(' ')[1] || ''}
                />
              </div>
            );
          })}

          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-[0_3px_16px_rgba(0,0,0,0.09)] mb-3.5 overflow-hidden transition-colors" style={{ '--subj-color': darkMode ? (activeTab === 'phy' ? '#7dd3fc' : activeTab === 'chem' ? '#fca5a5' : activeTab === 'math' ? '#d8b4fe' : activeTab === 'eng' ? '#5eead4' : '#fdba74') : SUBJECTS.find(s => s.id === activeTab)?.color } as React.CSSProperties}>
            <div className="p-2 px-3.5 flex items-center gap-2 bg-[#fafafa] dark:bg-[#252525] transition-colors">
              <span className="text-[9px] text-[#888] dark:text-[#a0a0a0]">Progress</span>
              <div className="flex-1 h-1.5 bg-[#e8e8e8] dark:bg-[#333] rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-300" 
                  style={{ 
                    width: `${getSubjectProgress(activeTab).pct}%`,
                    backgroundColor: 'var(--subj-color)'
                  }} 
                />
              </div>
              <span className="text-[9px] font-bold text-[#555] dark:text-[#d0d0d0] whitespace-nowrap">
                {getSubjectProgress(activeTab).n}/{getSubjectProgress(activeTab).total}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
