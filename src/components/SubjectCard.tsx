import { SubjectData, SubjectCode } from '../types';
import { motion } from 'motion/react';

interface SubjectCardProps {
  subj: SubjectCode;
  data: SubjectData;
  progress: { [key: string]: boolean };
  onToggle: (key: string) => void;
  subjName: string;
}

export default function SubjectCard({ subj, data, progress, onToggle, subjName }: SubjectCardProps) {
  const getChapKey = (chapter: string) => `${subj}__${chapter.trim().replace(/\s+/g, '_')}`;

  const branchColors = {
    physical: 'bg-[#e0f2fe] dark:bg-[#0c4a6e] text-[#0369a1] dark:text-[#7dd3fc]',
    inorganic: 'bg-[#fef3c7] dark:bg-[#78350f] text-[#a16207] dark:text-[#fde68a]',
    organic: 'bg-[#dcfce7] dark:bg-[#14532d] text-[#15803d] dark:text-[#86efac]',
  };

  const titleText = data.title || (data.chapters.length > 1 ? data.unit?.replace(/^Unit \d+ — /, '') : data.chapters[0]);

  return (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-[0_3px_16px_rgba(0,0,0,0.09)] mb-3.5 overflow-hidden transition-colors">
      {data.sec && (
        <div className="px-3.5 py-1.5 text-[9px] font-bold tracking-widest uppercase bg-[#f8f8f8] dark:bg-[#252525] border-b border-[#f0f0f0] dark:border-[#333] transition-colors">
          {data.sec}
        </div>
      )}
      <div className={`flex items-center justify-between px-3.5 py-2.5 border-l-[5px]`} style={{ borderLeftColor: 'var(--subj-color)' }}>
        <div>
          {data.unit && <div className="text-[9px] font-semibold opacity-70 mb-px">{data.unit}</div>}
          <h2 className="text-[13px] font-bold flex items-center">
            {titleText}
            {data.branch && (
              <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full ml-2 uppercase tracking-wider opacity-90 ${branchColors[data.branch.toLowerCase() as keyof typeof branchColors]}`}>
                {data.branch}
              </span>
            )}
          </h2>
        </div>
        {data.marks && (
          <div className="text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: 'var(--subj-badge-bg)', color: 'var(--subj-color)' }}>
            {data.marks} Marks
          </div>
        )}
      </div>

      {data.chapters.map((ch) => {
        const k = getChapKey(ch);
        return (
          <div key={k} className="flex items-center border-t border-[#f0f0f0] dark:border-[#333] transition-colors">
            <div className="flex-1 text-[11px] px-3.5 py-2.25 text-[#222] dark:text-[#d0d0d0] flex items-center justify-between">
              <span>{ch}</span>
            </div>
            <div className="flex items-center justify-center w-[50px] py-2.25 border-l border-[#f0f0f0] dark:border-[#333] transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 cursor-pointer accent-[var(--subj-color)]"
                checked={progress[k] || false}
                onChange={() => onToggle(k)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
