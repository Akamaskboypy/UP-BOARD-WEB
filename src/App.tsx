import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { SUBJECTS } from './constants';
import { SubjectCode, ProgressState } from './types';
import SubjectCard from './components/SubjectCard';
import AIModal from './components/AIModal';
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
  const [syncStatus, setSyncStatus] = useState({ 
    status: isDummyConfig ? 'synced' : 'connecting', 
    text: isDummyConfig ? 'Local Storage Active' : 'Connecting...' 
  });
  const [aiModal, setAiModal] = useState({ isOpen: false, subject: '', chapter: '', content: '', isLoading: false });

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
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
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

  const openAIGuide = async (subject: string, chapter: string) => {
    setAiModal({ isOpen: true, subject, chapter, content: '', isLoading: true });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Generate a quick study guide for the chapter "${chapter}" in the subject "${subject}" for UP Board Class 12.\n\nInclude strictly:\n1. ### Quick Summary\nA 2-3 sentence high-yield overview.\n2. ### Core Concepts to Memorize\n* 3-4 bullet points of formulas, definitions, or core facts.\n3. ### Test Yourself\nOne common exam-style question.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert tutor for UP Board Class 12. Return responses in clean Markdown format. Keep it concise, high-yield, and easy to read."
        }
      });

      setAiModal(prev => ({ ...prev, content: response.text || 'No content generated.', isLoading: false }));
    } catch (error) {
      console.error("AI Error:", error);
      setAiModal(prev => ({ ...prev, content: 'Error connecting to AI Tutor. Please try again later.', isLoading: false }));
    }
  };

  const getSubjectProgress = (subjId: string) => {
    const subj = SUBJECTS.find(s => s.id === subjId);
    if (!subj) return { n: 0, total: 0, pct: 0 };
    
    let total = 0;
    let n = 0;
    subj.data.forEach(d => {
      d.chapters.forEach(ch => {
        total++;
        const k = `${subjId}__${ch.replace(/\s+/g, '_').replace(/[^\w_]/g, '')}`;
        if (progress[k]) n++;
      });
    });
    
    const pct = total ? Math.round((n / total) * 100) : 0;
    return { n, total, pct };
  };

  if (!isAuthReady) {
    return (
      <div className="fixed inset-0 bg-[#f0ece4] flex flex-col items-center justify-center z-[999] gap-3">
        <div className="w-8 h-8 border-3 border-[#ddd] border-t-[#555] rounded-full animate-spin" />
        <p className="text-sm text-[#777]">Loading your progress...</p>
      </div>
    );
  }

  if (!isDummyConfig && !user) {
    return (
      <div className="fixed inset-0 bg-[#f0ece4] flex flex-col items-center justify-center z-[999] gap-6 p-4">
        <div className="text-center">
          <h1 className="main-title text-3xl font-black mb-2">UP Board Class 12</h1>
          <p className="text-[13px] text-[#777]">Sign in to sync your progress across devices.</p>
        </div>
        <button 
          onClick={handleGoogleSignIn}
          className="bg-white text-[#1a1a1a] font-bold py-3 px-6 rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] transition-all flex items-center gap-3 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 py-5 md:py-10">
      <h1 className="main-title text-3xl font-black text-center mb-1">UP Board Class 12</h1>
      <p className="text-center text-[11px] text-[#777] mb-4">Chapter-wise Study Checklist</p>

      <div className="flex items-center justify-center gap-2 mb-4 text-[10px] text-[#888]">
        <div className={`w-2 h-2 rounded-full ${syncStatus.status === 'syncing' ? 'bg-[#f59e0b] animate-pulse-sync' : syncStatus.status === 'synced' ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
        <span>{syncStatus.text}</span>
        {!isDummyConfig && user && (
          <button onClick={() => signOut(auth)} className="ml-2 underline hover:text-[#555] cursor-pointer">Sign Out</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4 justify-center">
        {SUBJECTS.map(s => {
          const { n, total, pct } = getSubjectProgress(s.id);
          return (
            <div key={s.id} className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] p-2.5 text-center min-w-[90px]">
              <div className="text-[9px] font-semibold color-[#aaa] uppercase tracking-wider mb-1">{s.id === 'phy' ? 'Physics' : s.id === 'chem' ? 'Chemistry' : s.id === 'math' ? 'Maths' : s.id === 'eng' ? 'English' : 'Hindi'}</div>
              <div className="text-lg font-bold leading-tight" style={{ color: s.color }}>{pct}%</div>
              <div className="text-[8px] text-[#aaa]">{n}/{total} done</div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mb-4 justify-center flex-wrap">
        {SUBJECTS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveTab(s.id as SubjectCode)}
            className={`px-4.5 py-2 border-none rounded-full font-semibold text-xs cursor-pointer transition-all ${activeTab === s.id ? 'text-white' : 'bg-[#e0dbd4] text-[#555]'}`}
            style={{ backgroundColor: activeTab === s.id ? s.color : undefined }}
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
          {SUBJECTS.find(s => s.id === activeTab)?.data.map((d, idx) => (
            <div key={idx} style={{ 
              '--subj-color': SUBJECTS.find(s => s.id === activeTab)?.color,
              '--subj-badge-bg': activeTab === 'phy' ? '#dce6f5' : activeTab === 'chem' ? '#f5ddd1' : activeTab === 'math' ? '#ede0f7' : activeTab === 'eng' ? '#ccfbf1' : '#fed7aa'
            } as React.CSSProperties}>
              <SubjectCard
                subj={activeTab}
                data={d}
                progress={progress}
                onToggle={handleToggle}
                onOpenAI={openAIGuide}
                subjName={SUBJECTS.find(s => s.id === activeTab)?.label.split(' ')[1] || ''}
              />
            </div>
          ))}

          <div className="bg-white rounded-xl shadow-[0_3px_16px_rgba(0,0,0,0.09)] mb-3.5 overflow-hidden" style={{ '--subj-color': SUBJECTS.find(s => s.id === activeTab)?.color } as React.CSSProperties}>
            <div className="p-2 px-3.5 flex items-center gap-2 bg-[#fafafa]">
              <span className="text-[9px] text-[#888]">Progress</span>
              <div className="flex-1 h-1.5 bg-[#e8e8e8] rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-300" 
                  style={{ 
                    width: `${getSubjectProgress(activeTab).pct}%`,
                    backgroundColor: 'var(--subj-color)'
                  }} 
                />
              </div>
              <span className="text-[9px] font-bold text-[#555] whitespace-nowrap">
                {getSubjectProgress(activeTab).n}/{getSubjectProgress(activeTab).total}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <AIModal
        isOpen={aiModal.isOpen}
        onClose={() => setAiModal(prev => ({ ...prev, isOpen: false }))}
        subject={aiModal.subject}
        chapter={aiModal.chapter}
        content={aiModal.content}
        isLoading={aiModal.isLoading}
      />
    </div>
  );
}
