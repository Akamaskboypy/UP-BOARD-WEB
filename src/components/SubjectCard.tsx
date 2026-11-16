import { Check, ChevronDown, ChevronRight, Play } from 'lucide-react';
import { SubjectData, SubjectCode } from '../types';

export interface SubjectCardProps {
  id?: string;
  unitIndex: number;
  subj: SubjectCode;
  data: SubjectData;
  visibleChapters: string[];
  progress: { [key: string]: boolean };
  onToggle: (key: string) => void;
  onBulkToggle: (keys: string[], targetState: boolean) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  accentColor: string;
  isHighlighted?: boolean;
  inheritedSection?: string;
  chapterStudySeconds?: Record<string, number>;
  onStartChapterFocus?: (subj: SubjectCode, chapter: string) => void;
  readOnly?: boolean;
}

function formatCompactDuration(seconds: number): string {
  if (!seconds || seconds < 60) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function SubjectCard({
  id,
  unitIndex,
  subj,
  data,
  visibleChapters,
  progress,
  onToggle,
  onBulkToggle,
  isCollapsed,
  onToggleCollapse,
  accentColor,
  isHighlighted = false,
  inheritedSection,
  chapterStudySeconds = {},
  onStartChapterFocus,
  readOnly = false,
}: SubjectCardProps) {
  const getChapKey = (chapter: string) => `${subj}__${chapter.trim().replace(/\s+/g, '_')}`;

  const allUnitKeys = data.chapters.map(getChapKey);
  const completedInUnit = allUnitKeys.filter((k) => Boolean(progress[k])).length;
  const totalInUnit = allUnitKeys.length;
  const isAllCompleted = totalInUnit > 0 && completedInUnit === totalInUnit;
  const isPartiallyCompleted = completedInUnit > 0 && !isAllCompleted;

  // Extract clean unit label & primary title
  const rawUnitLabel = data.unit ? data.unit.split(' — ')[0] : `Section ${String(unitIndex + 1).padStart(2, '0')}`;
  const unitSubTitle =
    data.title ||
    (data.unit && data.unit.includes(' — ')
      ? data.unit.split(' — ').slice(1).join(' — ')
      : data.chapters.length === 1
      ? data.chapters[0]
      : data.unit || `Unit ${unitIndex + 1}`);

  // Build unboxed inline metadata items (Zero-Pill Discipline)
  const metaParts: string[] = [rawUnitLabel];
  if (inheritedSection) {
    metaParts.push(inheritedSection.replace(/\s*\(\d+\s*Marks\)/i, ''));
  }
  if (data.branch) {
    metaParts.push(`${data.branch} Chemistry`);
  }
  if (typeof data.marks === 'number') {
    metaParts.push(`${data.marks} Marks`);
  }

  return (
    <section
      id={id}
      className={`bg-white dark:bg-[#111827] pitch:bg-[#070709] border transition-colors duration-150 rounded-lg overflow-hidden ${
        isHighlighted
          ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500/30'
          : 'border-slate-200 dark:border-slate-800 pitch:border-zinc-800/90'
      }`}
    >
      {/* Unit Header Bar */}
      <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-900/60 pitch:bg-[#0B0B0E] border-b border-slate-200/80 dark:border-slate-800/80 pitch:border-zinc-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand unit' : 'Collapse unit'}
            className="mt-0.5 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 pitch:hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <div className="min-w-0 flex-1">
            {/* Unboxed inline metadata row with typographic separators */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {metaParts.map((part, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5">
                  {idx > 0 && <span aria-hidden="true" className="text-slate-300 dark:text-slate-600 pitch:text-zinc-700">·</span>}
                  <span className={idx === metaParts.length - 1 && typeof data.marks === 'number' ? 'font-medium text-slate-700 dark:text-slate-300' : ''}>
                    {part}
                  </span>
                </span>
              ))}
            </div>

            {/* Unit Headline */}
            <h3
              onClick={onToggleCollapse}
              className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate cursor-pointer select-none"
            >
              {unitSubTitle}
            </h3>
          </div>
        </div>

        {/* Right Controls: Tabular Progress + Bulk Unit Action (hidden in readOnly Parent View) */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            {completedInUnit}/{totalInUnit} done
          </span>

          {!readOnly && (
            <button
              type="button"
              onClick={() => onBulkToggle(allUnitKeys, !isAllCompleted)}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 pitch:border-zinc-800 bg-white dark:bg-slate-800 pitch:bg-zinc-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 pitch:hover:bg-zinc-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isAllCompleted ? 'Reset Unit' : 'Complete Unit'}
            </button>
          )}
        </div>
      </div>

      {/* Slim 2px Unit Progress Line */}
      <div className="h-[2px] w-full bg-slate-100 dark:bg-slate-800/80 pitch:bg-zinc-900 overflow-hidden">
        <div
          className="h-full transition-all duration-200"
          style={{
            width: `${totalInUnit ? Math.round((completedInUnit / totalInUnit) * 100) : 0}%`,
            backgroundColor: accentColor,
          }}
        />
      </div>

      {/* High-Density Chapter Rows */}
      {!isCollapsed && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/70 pitch:divide-zinc-900">
          {visibleChapters.map((ch) => {
            const k = getChapKey(ch);
            const isChecked = Boolean(progress[k]);
            const originalIndex = data.chapters.indexOf(ch) + 1;
            const loggedTimeLabel = formatCompactDuration(chapterStudySeconds[`${subj}::${ch}`] || 0);

            if (readOnly) {
              return (
                <div
                  key={k}
                  className={`flex items-center justify-between gap-4 px-4 min-h-[42px] py-2 text-sm transition-colors duration-150 ${
                    isChecked
                      ? 'bg-slate-50/40 dark:bg-slate-900/30 pitch:bg-zinc-950/60 text-slate-500 dark:text-slate-400'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Chapter Index */}
                    <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500 w-6 shrink-0">
                      {String(originalIndex).padStart(2, '0')}
                    </span>

                    {/* Chapter Name */}
                    <span
                      className={`truncate font-normal ${
                        isChecked
                          ? 'text-slate-600 dark:text-slate-300'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {ch}
                    </span>
                  </div>

                  {/* Right-Aligned Unboxed Status & Study Duration */}
                  <div className="flex items-center gap-3 shrink-0 text-xs font-mono tabular-nums">
                    {loggedTimeLabel && (
                      <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                        {loggedTimeLabel} studied
                      </span>
                    )}
                    <span
                      className={
                        isChecked
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1'
                          : 'text-slate-400 dark:text-slate-500'
                      }
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      <span>{isChecked ? 'Completed' : 'Pending'}</span>
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={k}
                onClick={() => onToggle(k)}
                role="checkbox"
                aria-checked={isChecked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    onToggle(k);
                  }
                }}
                className={`group flex items-center justify-between gap-4 px-4 min-h-[42px] py-2 text-sm transition-colors duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800/60 pitch:focus-visible:bg-zinc-900 ${
                  isChecked
                    ? 'bg-slate-50/40 dark:bg-slate-900/30 pitch:bg-zinc-950/60 text-slate-400 dark:text-slate-500'
                    : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40 pitch:hover:bg-zinc-900/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Custom Accessible Checkbox */}
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-150 shrink-0 ${
                      isChecked
                        ? 'border-transparent text-white dark:text-slate-950'
                        : 'border-slate-300 dark:border-slate-600 pitch:border-zinc-700 bg-white dark:bg-slate-900 pitch:bg-black group-hover:border-slate-400 dark:group-hover:border-slate-500 pitch:group-hover:border-zinc-500'
                    }`}
                    style={{
                      backgroundColor: isChecked ? accentColor : undefined,
                    }}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>

                  {/* Chapter Index */}
                  <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500 w-6 shrink-0">
                    {String(originalIndex).padStart(2, '0')}
                  </span>

                  {/* Chapter Name */}
                  <span
                    className={`truncate font-normal transition-colors ${
                      isChecked ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {ch}
                  </span>
                </div>

                {/* Right-Aligned Actions & Unboxed Metadata */}
                <div className="flex items-center gap-3 shrink-0 text-xs font-mono tabular-nums">
                  {loggedTimeLabel && (
                    <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                      {loggedTimeLabel} studied
                    </span>
                  )}

                  {onStartChapterFocus && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartChapterFocus(subj, ch);
                      }}
                      title={`Start focus timer for ${ch}`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 pitch:border-zinc-800 bg-white dark:bg-slate-800 pitch:bg-zinc-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 pitch:hover:bg-zinc-900 transition-all inline-flex items-center gap-1 text-[11px] font-sans font-medium cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Focus</span>
                    </button>
                  )}

                  <span
                    className={
                      isChecked
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : isPartiallyCompleted
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-400 dark:text-slate-500'
                    }
                  >
                    {isChecked ? 'Completed' : 'Pending'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
