import { ArrowUpRight, CheckCircle2, Layers, Target } from 'lucide-react';
import { SubjectConfig } from '../constants';
import { ProgressState } from '../types';

interface AnalyticsInspectorProps {
  subject: SubjectConfig;
  progress: ProgressState;
  accentColor: string;
  onJumpToUnit: (unitIdx: number) => void;
}

export default function AnalyticsInspector({
  subject,
  progress,
  accentColor,
  onJumpToUnit,
}: AnalyticsInspectorProps) {
  const getChapKey = (chapter: string) => `${subject.id}__${chapter.trim().replace(/\s+/g, '_')}`;

  // Compute unit-level statistics
  const unitStats = subject.data.map((d, idx) => {
    const keys = d.chapters.map(getChapKey);
    const done = keys.filter((k) => Boolean(progress[k])).length;
    const total = keys.length;
    const marks = d.marks || 0;
    const isComplete = total > 0 && done === total;
    const proportionalMarks = total > 0 ? (done / total) * marks : 0;
    const label =
      d.title ||
      (d.unit && d.unit.includes(' — ')
        ? d.unit.split(' — ').slice(1).join(' — ')
        : d.chapters[0] || d.unit || `Unit ${idx + 1}`);
    const code = d.unit ? d.unit.split(' — ')[0] : `Sec ${idx + 1}`;

    return {
      idx,
      code,
      label,
      branch: d.branch,
      sec: d.sec,
      done,
      total,
      marks,
      isComplete,
      proportionalMarks,
      remainingChapters: total - done,
    };
  });

  const totalSubjectMarks = unitStats.reduce((sum, u) => sum + u.marks, 0);
  const fullySecuredMarks = unitStats.reduce((sum, u) => sum + (u.isComplete ? u.marks : 0), 0);
  const proportionalMarks = Math.round(unitStats.reduce((sum, u) => sum + u.proportionalMarks, 0));
  const totalChapters = unitStats.reduce((sum, u) => sum + u.total, 0);
  const completedChapters = unitStats.reduce((sum, u) => sum + u.done, 0);
  const completedUnits = unitStats.filter((u) => u.isComplete).length;

  // Group breakdown by Branch (for Chemistry) or Section (for Physics) or Unit Group
  const groups: { name: string; doneMarks: number; totalMarks: number; doneCh: number; totalCh: number }[] = [];
  if (subject.id === 'chem') {
    (['Physical', 'Inorganic', 'Organic'] as const).forEach((branch) => {
      const matching = unitStats.filter((u) => u.branch === branch);
      groups.push({
        name: `${branch} Chemistry`,
        doneMarks: Math.round(matching.reduce((s, u) => s + u.proportionalMarks, 0)),
        totalMarks: matching.reduce((s, u) => s + u.marks, 0),
        doneCh: matching.reduce((s, u) => s + u.done, 0),
        totalCh: matching.reduce((s, u) => s + u.total, 0),
      });
    });
  } else if (subject.id === 'phy') {
    let currentSec = 'Section A';
    const secMap = new Map<string, typeof unitStats>();
    unitStats.forEach((u) => {
      if (u.sec) {
        currentSec = u.sec.replace(/\s*\(\d+\s*Marks\)/i, '');
      }
      const list = secMap.get(currentSec) || [];
      list.push(u);
      secMap.set(currentSec, list);
    });
    secMap.forEach((list, name) => {
      groups.push({
        name,
        doneMarks: Math.round(list.reduce((s, u) => s + u.proportionalMarks, 0)),
        totalMarks: list.reduce((s, u) => s + u.marks, 0),
        doneCh: list.reduce((s, u) => s + u.done, 0),
        totalCh: list.reduce((s, u) => s + u.total, 0),
      });
    });
  } else {
    unitStats.forEach((u) => {
      groups.push({
        name: u.label,
        doneMarks: Math.round(u.proportionalMarks),
        totalMarks: u.marks,
        doneCh: u.done,
        totalCh: u.total,
      });
    });
  }

  // High-Yield Priority Units: Incomplete units ordered by highest exam marks first
  const priorityUnits = unitStats
    .filter((u) => !u.isComplete)
    .sort((a, b) => b.marks - a.marks || a.remainingChapters - b.remainingChapters)
    .slice(0, 4);

  return (
    <aside className="space-y-4">
      {/* Exam Readiness & Marks Weightage Panel */}
      <div className="bg-white dark:bg-[#111827] pitch:bg-[#070709] border border-slate-200 dark:border-slate-800 pitch:border-zinc-800/90 rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Target className="w-3.5 h-3.5 text-slate-400" />
            <span>Marks Readiness</span>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {subject.code}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800 pitch:border-zinc-900">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Estimated Coverage</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {proportionalMarks}
              <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                /{totalSubjectMarks}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Proportional marks
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Locked-In Units</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {fullySecuredMarks}
              <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                /{totalSubjectMarks}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              {completedUnits}/{unitStats.length} units complete
            </div>
          </div>
        </div>

        {/* Chapters vs Marks Comparison Bar */}
        <div className="pt-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Syllabus Coverage</span>
            <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
              {completedChapters}/{totalChapters} chapters ·{' '}
              {totalSubjectMarks > 0 ? Math.round((proportionalMarks / totalSubjectMarks) * 100) : 0}% weightage
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 pitch:bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-200 rounded-full"
              style={{
                width: `${totalSubjectMarks > 0 ? Math.round((proportionalMarks / totalSubjectMarks) * 100) : 0}%`,
                backgroundColor: accentColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* High-Yield Priority Queue */}
      <div className="bg-white dark:bg-[#111827] pitch:bg-[#070709] border border-slate-200 dark:border-slate-800 pitch:border-zinc-800/90 rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            High-Weightage Priority Units
          </h3>
          <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
            By Marks
          </span>
        </div>

        {priorityUnits.length === 0 ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              All {subject.name} units completed
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              100% of {totalSubjectMarks} exam marks covered.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 pitch:divide-zinc-900 -mx-4">
            {priorityUnits.map((u) => (
              <button
                key={u.idx}
                type="button"
                onClick={() => onJumpToUnit(u.idx)}
                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 pitch:hover:bg-zinc-900/60 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <span>{u.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {u.done}/{u.total} ch
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5 group-hover:text-slate-950 dark:group-hover:text-white">
                    {u.label}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-xs font-mono tabular-nums font-semibold"
                    style={{ color: accentColor }}
                  >
                    {u.marks}M
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Section / Branch Weightage Breakdown */}
      <div className="bg-white dark:bg-[#111827] pitch:bg-[#070709] border border-slate-200 dark:border-slate-800 pitch:border-zinc-800/90 rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Weightage Distribution
            </h3>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
            Marks
          </span>
        </div>

        <div className="space-y-3">
          {groups.map((g, idx) => {
            const pct = g.totalMarks > 0 ? Math.round((g.doneMarks / g.totalMarks) * 100) : 0;
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-700 dark:text-slate-300 truncate">{g.name}</span>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                    {g.doneMarks}/{g.totalMarks}M
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 pitch:bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-200 rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
