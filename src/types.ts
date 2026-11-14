export interface Chapter {
  name: string;
}

export interface SubjectData {
  sec?: string;
  unit?: string;
  title?: string;
  marks?: number;
  branch?: 'Physical' | 'Inorganic' | 'Organic';
  chapters: string[];
}

export type SubjectCode = 'phy' | 'chem' | 'math' | 'eng' | 'hin';

export interface ProgressState {
  [key: string]: boolean;
}

export type TimerMode = 'pomodoro' | 'stopwatch';
export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';
export type PomodoroPresetId = '25-5' | '50-10' | '90-15' | 'custom';

export interface StudySessionLog {
  id: string;
  date: string; // YYYY-MM-DD in local time
  subjectId: SubjectCode;
  chapter?: string;
  durationSeconds: number;
  mode: TimerMode | 'manual';
  completedAt: string; // ISO timestamp
}

export interface SharedSubjectSummary {
  done: number;
  total: number;
  pct: number;
  earnedMarks: number;
  totalMarks: number;
}

export interface SharedProgressDocument {
  ownerId: string;
  updatedAt: string;
  overallReadiness: {
    doneChapters: number;
    totalChapters: number;
    pct: number;
    earnedMarks: number;
    totalMarks: number;
  };
  subjectProgress: Record<string, SharedSubjectSummary>;
  dailyStudyMinutes: Record<string, number>;
  state: ProgressState;
  studyLogs: StudySessionLog[];
}
