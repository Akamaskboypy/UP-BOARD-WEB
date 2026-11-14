import { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { SUBJECTS } from '../constants';
import {
  PomodoroPhase,
  PomodoroPresetId,
  StudySessionLog,
  SubjectCode,
  TimerMode,
} from '../types';

export interface StudyTimerCalendarViewProps {
  darkMode: boolean;
  timerMode: TimerMode;
  onChangeTimerMode: (mode: TimerMode) => void;
  pomodoroPhase: PomodoroPhase;
  onChangePomodoroPhase: (phase: PomodoroPhase) => void;
  presetId: PomodoroPresetId;
  onChangePresetId: (preset: PomodoroPresetId) => void;
  customFocusMins: number;
  customBreakMins: number;
  onChangeCustomTimes: (focusMins: number, breakMins: number) => void;
  selectedSubject: SubjectCode;
  onChangeSelectedSubject: (subj: SubjectCode) => void;
  selectedChapter: string;
  onChangeSelectedChapter: (chapter: string) => void;
  isRunning: boolean;
  displaySeconds: number;
  targetSeconds: number;
  elapsedFocusSeconds: number;
  onStartPause: () => void;
  onResetTimer: () => void;
  onFinishAndLog: () => void;
  studyLogs: StudySessionLog[];
  onAddManualLog: (log: Omit<StudySessionLog, 'id' | 'completedAt'>) => void;
  onDeleteLog: (id: string) => void;
  readOnly?: boolean;
}

export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatClockDigits(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDurationHuman(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s === 0) return '0m';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  if (mins > 0) return `${mins}m`;
  return `${s}s`;
}

export default function StudyTimerCalendarView({
  darkMode,
  timerMode,
  onChangeTimerMode,
  pomodoroPhase,
  onChangePomodoroPhase,
  presetId,
  onChangePresetId,
  customFocusMins,
  customBreakMins,
  onChangeCustomTimes,
  selectedSubject,
  onChangeSelectedSubject,
  selectedChapter,
  onChangeSelectedChapter,
  isRunning,
  displaySeconds,
  targetSeconds,
  elapsedFocusSeconds,
  onStartPause,
  onResetTimer,
  onFinishAndLog,
  studyLogs,
  onAddManualLog,
  onDeleteLog,
  readOnly = false,
}: StudyTimerCalendarViewProps) {
  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarViewMode, setCalendarViewMode] = useState<'both' | 'monthly' | 'heatmap'>('both');

  // Manual session log drawer state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDate, setManualDate] = useState(todayStr);
  const [manualSubject, setManualSubject] = useState<SubjectCode>(selectedSubject);
  const [manualChapter, setManualChapter] = useState('');
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(45);

  const activeSubjectObj = useMemo(
    () => SUBJECTS.find((s) => s.id === selectedSubject) || SUBJECTS[0],
    [selectedSubject]
  );

  const activeAccent = darkMode ? activeSubjectObj.darkAccent : activeSubjectObj.lightAccent;

  // All chapters for the selected subject in timer
  const availableChapters = useMemo(() => {
    const list: string[] = [];
    activeSubjectObj.data.forEach((u) => {
      u.chapters.forEach((ch) => list.push(ch));
    });
    return list;
  }, [activeSubjectObj]);

  // All chapters for manual log subject
  const manualChapters = useMemo(() => {
    const subj = SUBJECTS.find((s) => s.id === manualSubject) || SUBJECTS[0];
    const list: string[] = [];
    subj.data.forEach((u) => {
      u.chapters.forEach((ch) => list.push(ch));
    });
    return list;
  }, [manualSubject]);

  // Aggregate logs by date (YYYY-MM-DD)
  const logsByDate = useMemo(() => {
    const map: Record<
      string,
      {
        totalSeconds: number;
        bySubject: Record<SubjectCode, number>;
        sessions: StudySessionLog[];
      }
    > = {};

    studyLogs.forEach((log) => {
      if (!map[log.date]) {
        map[log.date] = {
          totalSeconds: 0,
          bySubject: { phy: 0, chem: 0, math: 0, eng: 0, hin: 0 },
          sessions: [],
        };
      }
      map[log.date].totalSeconds += log.durationSeconds;
      map[log.date].bySubject[log.subjectId] =
        (map[log.date].bySubject[log.subjectId] || 0) + log.durationSeconds;
      map[log.date].sessions.push(log);
    });

    return map;
  }, [studyLogs]);

  // Compute KPI metrics: Today, Streak, Last 7 Days, Total
  const stats = useMemo(() => {
    const todayTotal = logsByDate[todayStr]?.totalSeconds || 0;
    const todaySessions = logsByDate[todayStr]?.sessions.length || 0;

    // Last 7 days total
    let last7Seconds = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dStr = getLocalDateString(d);
      last7Seconds += logsByDate[dStr]?.totalSeconds || 0;
    }

    // Current consecutive daily study streak
    let streak = 0;
    const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!logsByDate[getLocalDateString(checkDate)]?.totalSeconds) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const dStr = getLocalDateString(checkDate);
      if ((logsByDate[dStr]?.totalSeconds || 0) > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const allTimeSeconds = studyLogs.reduce((acc, l) => acc + l.durationSeconds, 0);

    return {
      todayTotal,
      todaySessions,
      last7Seconds,
      streak,
      allTimeSeconds,
      allTimeCount: studyLogs.length,
    };
  }, [logsByDate, studyLogs, todayStr]);

  // Build Monthly Calendar Cells (Monday-first 7-column grid)
  const monthlyCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Convert JS Sunday=0..Saturday=6 to Monday=0..Sunday=6
    const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;

    const cells: {
      dateStr: string;
      dayNumber: number;
      inCurrentMonth: boolean;
      totalSeconds: number;
      bySubject: Record<SubjectCode, number>;
    }[] = [];

    // Leading days from previous month
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDate - i);
      const dStr = getLocalDateString(d);
      cells.push({
        dateStr: dStr,
        dayNumber: d.getDate(),
        inCurrentMonth: false,
        totalSeconds: logsByDate[dStr]?.totalSeconds || 0,
        bySubject: logsByDate[dStr]?.bySubject || { phy: 0, chem: 0, math: 0, eng: 0, hin: 0 },
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dStr = getLocalDateString(d);
      cells.push({
        dateStr: dStr,
        dayNumber: day,
        inCurrentMonth: true,
        totalSeconds: logsByDate[dStr]?.totalSeconds || 0,
        bySubject: logsByDate[dStr]?.bySubject || { phy: 0, chem: 0, math: 0, eng: 0, hin: 0 },
      });
    }

    // Trailing days to complete 6 weeks (42 cells) or 5 weeks (35 cells)
    const targetCells = cells.length > 35 ? 42 : 35;
    let nextMonthDay = 1;
    while (cells.length < targetCells) {
      const d = new Date(year, month + 1, nextMonthDay++);
      const dStr = getLocalDateString(d);
      cells.push({
        dateStr: dStr,
        dayNumber: d.getDate(),
        inCurrentMonth: false,
        totalSeconds: logsByDate[dStr]?.totalSeconds || 0,
        bySubject: logsByDate[dStr]?.bySubject || { phy: 0, chem: 0, math: 0, eng: 0, hin: 0 },
      });
    }

    return cells;
  }, [calendarMonth, logsByDate]);

  const currentMonthTotalSeconds = useMemo(() => {
    return monthlyCells
      .filter((c) => c.inCurrentMonth)
      .reduce((acc, c) => acc + c.totalSeconds, 0);
  }, [monthlyCells]);

  // Build GitHub-Style 28-Week Activity Heatmap (Mon-Sun rows, 28 columns ending this week)
  const heatmapWeeks = useMemo(() => {
    const numWeeks = 28;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentWeekday = (today.getDay() + 6) % 7; // Mon=0..Sun=6
    const endOfThisWeek = new Date(today);
    endOfThisWeek.setDate(today.getDate() + (6 - currentWeekday));

    const startDate = new Date(endOfThisWeek);
    startDate.setDate(endOfThisWeek.getDate() - numWeeks * 7 + 1);

    const weeks: {
      monthLabel?: string;
      days: {
        dateStr: string;
        dateObj: Date;
        totalSeconds: number;
        isFuture: boolean;
      }[];
    }[] = [];

    let lastMonth = -1;
    const cursor = new Date(startDate);

    for (let w = 0; w < numWeeks; w++) {
      const days = [];
      let monthLabel: string | undefined = undefined;

      for (let d = 0; d < 7; d++) {
        const dStr = getLocalDateString(cursor);
        if (d === 0 && cursor.getMonth() !== lastMonth) {
          monthLabel = cursor.toLocaleDateString('en-US', { month: 'short' });
          lastMonth = cursor.getMonth();
        }
        days.push({
          dateStr: dStr,
          dateObj: new Date(cursor),
          totalSeconds: logsByDate[dStr]?.totalSeconds || 0,
          isFuture: cursor > today,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push({ monthLabel, days });
    }

    return weeks;
  }, [logsByDate]);

  const selectedDayData = logsByDate[selectedDate] || {
    totalSeconds: 0,
    bySubject: { phy: 0, chem: 0, math: 0, eng: 0, hin: 0 },
    sessions: [],
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const totalSecs = manualHours * 3600 + manualMinutes * 60;
    if (totalSecs <= 0) return;

    onAddManualLog({
      date: manualDate,
      subjectId: manualSubject,
      ...(manualChapter ? { chapter: manualChapter } : {}),
      durationSeconds: totalSecs,
      mode: 'manual',
    });

    setSelectedDate(manualDate);
    setShowManualForm(false);
  };

  const progressFraction =
    timerMode === 'pomodoro' && targetSeconds > 0
      ? Math.min(100, Math.max(0, ((targetSeconds - displaySeconds) / targetSeconds) * 100))
      : 100;

  // Intensity class helper for heatmap
  const getHeatmapCellClass = (seconds: number, isFuture: boolean) => {
    if (isFuture) return 'bg-transparent border-transparent pointer-events-none';
    if (seconds <= 0)
      return 'bg-slate-100 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-800';
    if (seconds < 45 * 60)
      return 'bg-emerald-200 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800';
    if (seconds < 120 * 60)
      return 'bg-emerald-400 dark:bg-emerald-700 border-emerald-500 dark:border-emerald-600';
    if (seconds < 240 * 60)
      return 'bg-emerald-500 dark:bg-emerald-500 border-emerald-600 dark:border-emerald-400';
    return 'bg-emerald-700 dark:bg-emerald-400 border-emerald-800 dark:border-emerald-300';
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Studied Today</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatDurationHuman(stats.todayTotal)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-1">
            {stats.todaySessions} {stats.todaySessions === 1 ? 'session' : 'sessions'} logged today
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Daily Streak</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Consecutive study days
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Last 7 Days</span>
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatDurationHuman(stats.last7Seconds)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-1">
            Avg {formatDurationHuman(Math.round(stats.last7Seconds / 7))}/day
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Cumulative Study</span>
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatDurationHuman(stats.allTimeSeconds)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-1">
            {stats.allTimeCount} total sessions recorded
          </div>
        </div>
      </div>

      {/* Pomodoro & Stopwatch Focus Console (Hidden in Read-Only Parent View) */}
      {!readOnly && (
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          {/* Top Mode & Preset Bar */}
          <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            {/* Mode Switcher: Pomodoro vs Stopwatch */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => onChangeTimerMode('pomodoro')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    timerMode === 'pomodoro'
                      ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Pomodoro Timer
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTimerMode('stopwatch')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    timerMode === 'stopwatch'
                      ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Open Stopwatch
                </button>
              </div>

              {/* Pomodoro Presets */}
              {timerMode === 'pomodoro' && (
                <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                  {(
                    [
                      { id: '25-5', label: '25m / 5m' },
                      { id: '50-10', label: '50m / 10m' },
                      { id: '90-15', label: '90m / 15m' },
                      { id: 'custom', label: 'Custom' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChangePresetId(p.id)}
                      className={`px-2.5 py-1 rounded text-xs font-mono tabular-nums font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        presetId === p.id
                          ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Action: Log Offline Session Toggle */}
            <button
              type="button"
              onClick={() => setShowManualForm(!showManualForm)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showManualForm ? 'Close Manual Log' : 'Log Past Session'}</span>
            </button>
          </div>

          {/* Custom Duration Inputs (when Custom Pomodoro preset is active) */}
          {timerMode === 'pomodoro' && presetId === 'custom' && (
            <div className="px-4 py-2.5 bg-slate-50/40 dark:bg-slate-900/30 border-b border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-400">
                Custom Pomodoro Durations:
              </span>
              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span>Focus (mins)</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customFocusMins}
                  onChange={(e) =>
                    onChangeCustomTimes(
                      Math.max(1, Math.min(180, Number(e.target.value) || 25)),
                      customBreakMins
                    )
                  }
                  className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums text-xs"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span>Break (mins)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={customBreakMins}
                  onChange={(e) =>
                    onChangeCustomTimes(
                      customFocusMins,
                      Math.max(1, Math.min(60, Number(e.target.value) || 5))
                    )
                  }
                  className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums text-xs"
                />
              </label>
            </div>
          )}

          {/* Manual Past Session Entry Drawer */}
          {showManualForm && (
            <form
              onSubmit={handleManualSubmit}
              className="p-4 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Study Date
                </label>
                <input
                  type="date"
                  value={manualDate}
                  max={todayStr}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Subject
                </label>
                <select
                  value={manualSubject}
                  onChange={(e) => {
                    setManualSubject(e.target.value as SubjectCode);
                    setManualChapter('');
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Chapter (Optional)
                </label>
                <select
                  value={manualChapter}
                  onChange={(e) => setManualChapter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">General Subject Study</option>
                  {manualChapters.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Hours
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={16}
                    value={manualHours}
                    onChange={(e) => setManualHours(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap h-[32px]"
              >
                Save Log Entry
              </button>
            </form>
          )}

          {/* Main Timer Body */}
          <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Column: Subject & Chapter Tagging */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Active Study Target
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Link Session to Subject & Chapter
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Completed focus sessions are automatically logged to your daily calendar under
                  this subject.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Subject
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {SUBJECTS.map((s) => {
                      const isSelected = selectedSubject === s.id;
                      const sAccent = darkMode ? s.darkAccent : s.lightAccent;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onChangeSelectedSubject(s.id)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer truncate ${
                            isSelected
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                          style={
                            isSelected
                              ? { backgroundColor: sAccent, color: darkMode ? '#0B0F17' : '#FFFFFF' }
                              : undefined
                          }
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="timer-chapter-select"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Chapter / Topic
                  </label>
                  <select
                    id="timer-chapter-select"
                    value={selectedChapter}
                    onChange={(e) => onChangeSelectedChapter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
                  >
                    <option value="">General {activeSubjectObj.name} Revision</option>
                    {availableChapters.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Right Column: Digital Clock Readout & Controls */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-end justify-center">
              <div className="w-full max-w-md bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 text-center space-y-4">
                {/* Phase Switcher for Pomodoro */}
                {timerMode === 'pomodoro' ? (
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/60 dark:bg-slate-800">
                    {(
                      [
                        { id: 'focus', label: 'Focus Session' },
                        { id: 'shortBreak', label: 'Short Break' },
                        { id: 'longBreak', label: 'Long Break' },
                      ] as const
                    ).map((ph) => (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => onChangePomodoroPhase(ph.id)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          pomodoroPhase === ph.id
                            ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {ph.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Open-Ended Stopwatch · Logs Elapsed Study Time
                  </div>
                )}

                {/* Unboxed Active Context Line */}
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate px-2">
                  <span className="font-semibold" style={{ color: activeAccent }}>
                    {activeSubjectObj.name}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>{selectedChapter || 'General Revision'}</span>
                </div>

                {/* Giant Tabular-Nums Clock Display */}
                <div className="font-mono tabular-nums text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 dark:text-slate-100 py-1">
                  {formatClockDigits(displaySeconds)}
                </div>

                {/* Progress Track */}
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-200 rounded-full"
                    style={{
                      width: `${progressFraction}%`,
                      backgroundColor:
                        timerMode === 'pomodoro' && pomodoroPhase !== 'focus'
                          ? '#10B981'
                          : activeAccent,
                    }}
                  />
                </div>

                {/* Control Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onStartPause}
                    className="px-5 py-2.5 rounded-lg font-medium text-xs sm:text-sm text-white dark:text-slate-950 transition-opacity hover:opacity-95 inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: activeAccent,
                    }}
                  >
                    {isRunning ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>{elapsedFocusSeconds > 0 ? 'Resume' : 'Start Timer'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onResetTimer}
                    className="px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  {(timerMode === 'stopwatch' || pomodoroPhase === 'focus') &&
                    elapsedFocusSeconds >= 1 && (
                      <button
                        type="button"
                        onClick={onFinishAndLog}
                        className="px-3.5 py-2.5 rounded-lg border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Finish & Log ({formatDurationHuman(elapsedFocusSeconds)})</span>
                      </button>
                    )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Calendar View Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Daily Study Calendar & Activity Log
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select any date on the monthly calendar or yearly heatmap to inspect logged study
            sessions and subject distribution.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-lg bg-slate-200/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 self-start">
          {(
            [
              { id: 'both', label: 'Both Views' },
              { id: 'monthly', label: 'Monthly Grid' },
              { id: 'heatmap', label: 'Yearly Heatmap' },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setCalendarViewMode(v.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                calendarViewMode === v.id
                  ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Calendar + Daily Breakdown Multi-Pane Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Monthly Calendar Grid & GitHub-Style Activity Heatmap */}
        <div className="xl:col-span-8 space-y-6">
          {/* 1. Monthly Calendar Grid */}
          {(calendarViewMode === 'both' || calendarViewMode === 'monthly') && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {/* Calendar Header */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-display font-bold text-sm md:text-base text-slate-900 dark:text-slate-100">
                    {calendarMonth.toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    · {formatDurationHuman(currentMonthTotalSeconds)} studied this month
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                      )
                    }
                    aria-label="Previous month"
                    className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                      setSelectedDate(todayStr);
                    }}
                    className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                      )
                    }
                    aria-label="Next month"
                    className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Weekday Column Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 text-[11px] font-mono text-slate-500 dark:text-slate-400 text-center py-2">
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
                <div>Sun</div>
              </div>

              {/* 7-Column Day Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
                {monthlyCells.map((cell) => {
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selectedDate;
                  const hasStudy = cell.totalSeconds > 0;

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={`min-h-[78px] sm:min-h-[88px] p-2 flex flex-col justify-between text-left transition-colors cursor-pointer relative ${
                        !cell.inCurrentMonth
                          ? 'bg-slate-50/40 dark:bg-slate-950/30 text-slate-400 dark:text-slate-600'
                          : 'bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200'
                      } ${
                        isSelected
                          ? 'ring-2 ring-inset ring-blue-600 dark:ring-blue-400 bg-blue-50/20 dark:bg-blue-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            isToday
                              ? 'font-bold text-blue-600 dark:text-blue-400 underline underline-offset-2'
                              : 'font-medium'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>

                        {hasStudy && (
                          <span className="text-[10px] font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                            {formatDurationHuman(cell.totalSeconds)}
                          </span>
                        )}
                      </div>

                      {/* Subject Breakdown Stacked Horizontal Bar inside the Day Cell */}
                      {hasStudy ? (
                        <div className="w-full space-y-1 mt-2">
                          <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                            {SUBJECTS.map((s) => {
                              const sec = cell.bySubject[s.id] || 0;
                              if (sec <= 0) return null;
                              const widthPct = Math.max(
                                8,
                                Math.round((sec / cell.totalSeconds) * 100)
                              );
                              return (
                                <div
                                  key={s.id}
                                  style={{
                                    width: `${widthPct}%`,
                                    backgroundColor: darkMode ? s.darkAccent : s.lightAccent,
                                  }}
                                />
                              );
                            })}
                          </div>
                          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                            {SUBJECTS.filter((s) => (cell.bySubject[s.id] || 0) > 0)
                              .map((s) => s.name.slice(0, 3))
                              .join(' · ')}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono text-slate-300 dark:text-slate-700 hidden sm:block">
                          —
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. GitHub-Style Yearly / Multi-Month Activity Heatmap */}
          {(calendarViewMode === 'both' || calendarViewMode === 'heatmap') && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 md:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                    Study Consistency Heatmap
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Daily study intensity across the past 28 weeks · Click any square to inspect
                    that day
                  </p>
                </div>

                {/* Intensity Legend */}
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  <span>Less</span>
                  <span className="w-3 h-3 rounded-xs bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700" />
                  <span className="w-3 h-3 rounded-xs bg-emerald-200 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800" />
                  <span className="w-3 h-3 rounded-xs bg-emerald-400 dark:bg-emerald-700" />
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 dark:bg-emerald-500" />
                  <span className="w-3 h-3 rounded-xs bg-emerald-700 dark:bg-emerald-400" />
                  <span>More (4h+)</span>
                </div>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="inline-flex flex-col min-w-full">
                  {/* Month Labels Row */}
                  <div className="flex items-center gap-1 pl-8 mb-1.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 h-4">
                    {heatmapWeeks.map((wk, wIdx) => (
                      <div key={wIdx} className="w-3.5 shrink-0 relative">
                        {wk.monthLabel && (
                          <span className="absolute left-0 top-0 whitespace-nowrap">
                            {wk.monthLabel}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Heatmap Grid with Weekday Labels */}
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col justify-between h-[106px] text-[10px] font-mono text-slate-400 dark:text-slate-500 pr-1 py-0.5 shrink-0">
                      <span>Mon</span>
                      <span>Wed</span>
                      <span>Fri</span>
                      <span>Sun</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {heatmapWeeks.map((wk, wIdx) => (
                        <div key={wIdx} className="flex flex-col gap-1">
                          {wk.days.map((d) => {
                            const isSelected = d.dateStr === selectedDate;
                            return (
                              <button
                                key={d.dateStr}
                                type="button"
                                disabled={d.isFuture}
                                onClick={() => setSelectedDate(d.dateStr)}
                                title={`${d.dateStr}: ${formatDurationHuman(d.totalSeconds)}`}
                                className={`w-3.5 h-3.5 rounded-xs border transition-transform cursor-pointer ${getHeatmapCellClass(
                                  d.totalSeconds,
                                  d.isFuture
                                )} ${
                                  isSelected
                                    ? 'ring-2 ring-blue-600 dark:ring-blue-400 scale-110 z-10'
                                    : 'hover:scale-110'
                                }`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Columns: Selected Date Inspector Panel */}
        <aside className="xl:col-span-4 xl:sticky xl:top-20 space-y-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4">
            {/* Selected Date Header */}
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-mono text-slate-400 dark:text-slate-500">
                  {selectedDate === todayStr ? 'Today · Daily Study Log' : 'Selected Date Log'}
                </div>
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
              </div>

              <div className="text-right font-mono tabular-nums">
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatDurationHuman(selectedDayData.totalSeconds)}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                  {selectedDayData.sessions.length}{' '}
                  {selectedDayData.sessions.length === 1 ? 'session' : 'sessions'}
                </div>
              </div>
            </div>

            {/* Subject Breakdown for Selected Day */}
            {selectedDayData.totalSeconds > 0 && (
              <div className="space-y-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Subject Time Breakdown
                </div>
                {SUBJECTS.map((s) => {
                  const sec = selectedDayData.bySubject[s.id] || 0;
                  if (sec <= 0) return null;
                  const pct = Math.round((sec / selectedDayData.totalSeconds) * 100);
                  const sAccent = darkMode ? s.darkAccent : s.lightAccent;

                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {s.name}
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatDurationHuman(sec)} · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{ width: `${pct}%`, backgroundColor: sAccent }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Chronological Session List for Selected Day */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Logged Sessions
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualDate(selectedDate);
                      setShowManualForm(true);
                    }}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    + Add entry
                  </button>
                )}
              </div>

              {selectedDayData.sessions.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg px-4">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    No study sessions logged on this date
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {readOnly
                      ? 'Select another highlighted date on the calendar to view recorded study sessions.'
                      : 'Start the Pomodoro or Stopwatch timer above, or add a past session manually.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto -mx-4 px-4">
                  {selectedDayData.sessions
                    .slice()
                    .reverse()
                    .map((sess) => {
                      const subjObj =
                        SUBJECTS.find((s) => s.id === sess.subjectId) || SUBJECTS[0];
                      const sAccent = darkMode ? subjObj.darkAccent : subjObj.lightAccent;
                      const timeStr = new Date(sess.completedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={sess.id}
                          className="py-2.5 flex items-start justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              <span className="font-semibold" style={{ color: sAccent }}>
                                {subjObj.name}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize">{sess.mode}</span>
                              <span aria-hidden="true">·</span>
                              <span>{timeStr}</span>
                            </div>
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                              {sess.chapter || `General ${subjObj.name} Study`}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                              {formatDurationHuman(sess.durationSeconds)}
                            </span>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => onDeleteLog(sess.id)}
                                title="Delete session log"
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
