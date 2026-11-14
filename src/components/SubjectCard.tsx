import { Check, ChevronDown, ChevronRight } from 'lucide-react';
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
      className={`bg-white dark:bg-[#111827] border transition-colors duration-150 rounded-lg overflow-hidden ${
        isHighlighted
          ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500/30'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Unit Header Bar */}
      <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand unit' : 'Collapse unit'}
            className="mt-0.5 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <div className="min-w-0 flex-1">
            {/* Unboxed inline metadata row with typographic separators */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {metaParts.map((part, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5">
                  {idx > 0 && <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>}
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

        {/* Right Controls: Tabular Progress + Bulk Unit Action */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            {completedInUnit}/{totalInUnit} done
          </span>

          <button
            type="button"
            onClick={() => onBulkToggle(allUnitKeys, !isAllCompleted)}
            className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isAllCompleted ? 'Reset Unit' : 'Complete Unit'}
          </button>
        </div>
      </div>

      {/* Slim 2px Unit Progress Line */}
      <div className="h-[2px] w-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
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
        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {visibleChapters.map((ch) => {
            const k = getChapKey(ch);
            const isChecked = Boolean(progress[k]);
            const originalIndex = data.chapters.indexOf(ch) + 1;

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
                className={`group flex items-center justify-between gap-4 px-4 min-h-[42px] py-2 text-sm transition-colors duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800/60 ${
                  isChecked
                    ? 'bg-slate-50/40 dark:bg-slate-900/30 text-slate-400 dark:text-slate-500'
                    : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Custom Accessible Checkbox */}
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-150 shrink-0 ${
                      isChecked
                        ? 'border-transparent text-white dark:text-slate-950'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 group-hover:border-slate-400 dark:group-hover:border-slate-500'
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

                {/* Right-Aligned Unboxed Status Text */}
                <div className="flex items-center gap-2 shrink-0 text-xs font-mono tabular-nums">
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
