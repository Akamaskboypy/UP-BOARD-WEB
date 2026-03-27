import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  chapter: string;
  content: string;
  isLoading: boolean;
}

export default function AIModal({ isOpen, onClose, subject, chapter, content, isLoading }: AIModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-5"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-[500px] rounded-2xl p-6 relative max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 bg-[#f0ece4] hover:bg-[#e0dbd4] w-7 h-7 rounded-full flex items-center justify-center text-[#555] transition-colors"
              onClick={onClose}
            >
              <X size={16} />
            </button>

            <h2 className="font-playfair text-lg font-bold mb-1 text-[#1a1a1a]">✨ AI Chapter Cheat Sheet</h2>
            <p className="text-[11px] text-[#888] mb-4 uppercase font-bold tracking-wider">
              {subject} • {chapter}
            </p>

            <div id="ai-modal-body">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3 py-8 text-[#666] font-semibold text-sm">
                  <div className="w-6 h-6 border-3 border-[#ddd] border-t-[#555] rounded-full animate-spin" />
                  <span>Gemini is analyzing the syllabus...</span>
                </div>
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
