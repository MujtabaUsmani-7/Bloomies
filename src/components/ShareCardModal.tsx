import { useEffect, useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import { FLOWER_STAGES } from '../game/flowers';
import { formatReadableDate, getTodayDateKey } from '../game/daily';
import { renderShareCardDataUrl } from '../game/renderer';
import { GameMode } from '../game/types';

interface ShareCardModalProps {
  open: boolean;
  score: number;
  bestStage: number;
  maxCombo: number;
  mode: GameMode;
  onClose: () => void;
}

export function ShareCardModal({
  open,
  score,
  bestStage,
  maxCombo,
  mode,
  onClose,
}: ShareCardModalProps) {
  const [dataUrl, setDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const modeLabel = mode === 'daily' ? 'Daily Garden' : 'Classic Garden';
    const dateLabel = formatReadableDate(getTodayDateKey());
    const url = renderShareCardDataUrl({
      score,
      bestStage,
      maxCombo,
      modeLabel,
      dateLabel,
    });
    setDataUrl(url);
    setCopied(false);
  }, [open, score, bestStage, maxCombo, mode]);

  if (!open) return null;

  const flowerName = FLOWER_STAGES[bestStage]?.name || 'Seed';

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `bloomies-${flowerName.toLowerCase().replace(/\s+/g, '-')}-${score}.png`;
    link.click();
  };

  const handleCopyText = async () => {
    const modeText = mode === 'daily' ? `Daily Garden (${getTodayDateKey()})` : 'Classic Garden';
    const text = `Bloomies · ${modeText}\nScore: ${score.toLocaleString()} | Best Bloom: ${flowerName} | Max Combo: x${maxCombo}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in restricted iframe
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#4A3550]/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[#4A3550]/12 bg-[#FFF8F2] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#4A3550]/10 px-5 py-4">
          <h2 id="share-card-title" className="font-display text-xl font-bold text-[#4A3550]">
            Share My Best Bloom
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#4A3550]/10 bg-white text-[#4A3550] hover:bg-[#FFF1E6]"
            aria-label="Close share card"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center p-5">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`Bloomies score card showing ${flowerName} with ${score} points`}
              className="w-full max-w-[300px] rounded-2xl border border-[#4A3550]/10 shadow-sm"
            />
          ) : (
            <div className="flex h-[360px] w-[300px] items-center justify-center rounded-2xl bg-white text-sm text-[#4A3550]/60">
              Generating bloom card...
            </div>
          )}

          <div className="mt-5 flex w-full gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF7EB6] px-4 py-2.5 text-sm font-bold text-[#4A3550] transition-colors hover:bg-[#ff6aa9] whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" />
              Save Image
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#4A3550]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#4A3550] transition-colors hover:bg-[#FFF1E6] whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="h-4 w-4 text-[#439A6C]" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy Score'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
