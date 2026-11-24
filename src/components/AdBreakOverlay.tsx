import { PlayCircle } from 'lucide-react';
import { AdBreakPreviewState } from '../game/ads';

interface AdBreakOverlayProps {
  preview: AdBreakPreviewState;
}

export function AdBreakOverlay({ preview }: AdBreakOverlayProps) {
  if (!preview.active) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#4A3550]/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Rewarded sponsor break"
    >
      <div className="w-full max-w-sm rounded-3xl border border-[#4A3550]/15 bg-[#FFF8F2] p-6 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD93D]/45 text-[#8B6200]">
          <PlayCircle className="h-6 w-6" />
        </div>
        <h3 className="mt-3 font-display text-xl font-bold text-[#4A3550]">
          {preview.kind === 'rewarded' ? 'Sponsor Reward Break' : 'Short Garden Break'}
        </h3>
        <p className="mt-1 text-sm text-[#4A3550]/75">{preview.placementLabel}</p>
        <div className="mt-4 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 font-mono text-sm font-bold text-[#4A3550] tabular-nums">
          Resuming in {preview.secondsLeft}s...
        </div>
      </div>
    </div>
  );
}
