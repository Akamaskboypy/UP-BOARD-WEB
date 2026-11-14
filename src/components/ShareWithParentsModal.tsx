import { useState } from 'react';
import { Check, Copy, ExternalLink, Lock, RefreshCw, ShieldCheck, X } from 'lucide-react';

interface ShareWithParentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareToken: string | null;
  isBusy: boolean;
  onGenerateOrResetLink: () => Promise<void>;
}

export default function ShareWithParentsModal({
  isOpen,
  onClose,
  shareToken,
  isBusy,
  onGenerateOrResetLink,
}: ShareWithParentsModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!isOpen) return null;

  const shareUrl = shareToken ? `${window.location.origin}/parent/${shareToken}` : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = async () => {
    await onGenerateOrResetLink();
    setConfirmReset(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Window */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-parents-title"
        className="relative z-10 w-full max-w-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-600 dark:text-emerald-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Read-Only · Zero Personal Data</span>
            </div>
            <h2
              id="share-parents-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Share Progress with Parents
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explanation */}
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Anyone with this secret link can view your live syllabus readiness, completed chapters,
          and daily study calendar without logging in. Your email address is never stored or
          displayed on the shared page.
        </p>

        {/* Secret Link Box */}
        {shareToken ? (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Secret Read-Only Parent Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {resetSuccess && (
              <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                New link generated. The previous link has been deleted and deactivated.
              </div>
            )}

            {/* Footer Controls: Preview + Reset Link */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <a
                href={`/parent/${shareToken}`}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Open Parent View</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {confirmReset ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleReset}
                    className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    {isBusy ? 'Resetting...' : 'Confirm Reset'}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmReset(false)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setConfirmReset(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                  <span>Reset Link</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="pt-1">
            <button
              type="button"
              disabled={isBusy}
              onClick={onGenerateOrResetLink}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isBusy ? 'Generating Secret Link...' : 'Generate Secret Parent Link'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
