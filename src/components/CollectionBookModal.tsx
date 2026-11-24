import { X } from 'lucide-react';
import { FLOWER_STAGES } from '../game/flowers';
import { PlayerProgress } from '../game/types';
import { FlowerThumbnail } from './FlowerThumbnail';

interface CollectionBookModalProps {
  open: boolean;
  progress: PlayerProgress;
  onClose: () => void;
}

export function CollectionBookModal({ open, progress, onClose }: CollectionBookModalProps) {
  if (!open) return null;

  const unlockedSet = new Set(progress.unlockedStages);
  const unlockedCount = FLOWER_STAGES.filter((f) => unlockedSet.has(f.stage)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#4A3550]/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collection-book-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#4A3550]/12 bg-[#FFF8F2] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#4A3550]/10 px-6 py-4">
          <div>
            <h2
              id="collection-book-title"
              className="font-display text-2xl font-bold text-[#4A3550]"
            >
              Garden Collection Book
            </h2>
            <p className="mt-0.5 text-sm text-[#4A3550]/70 tabular-nums">
              {unlockedCount} of {FLOWER_STAGES.length} blooms discovered · {progress.totalMerges.toLocaleString()} total merges
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4A3550]/10 bg-white text-[#4A3550] transition-colors hover:bg-[#FFF1E6]"
            aria-label="Close collection book"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
          {FLOWER_STAGES.map((flower) => {
            const isUnlocked = unlockedSet.has(flower.stage);
            const mergeCount = progress.stageMergeCounts[flower.stage] || 0;
            return (
              <div
                key={flower.id}
                className={`flex gap-4 rounded-2xl border p-4 transition-colors ${
                  isUnlocked
                    ? 'border-[#4A3550]/10 bg-white'
                    : 'border-dashed border-[#4A3550]/15 bg-white/50'
                }`}
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1E6]/70">
                  <FlowerThumbnail stage={flower.stage} size={58} locked={!isUnlocked} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-[#4A3550] truncate">
                      {isUnlocked ? flower.name : 'Undiscovered Bloom'}
                    </h3>
                    <span className="text-xs font-medium text-[#4A3550]/60 tabular-nums whitespace-nowrap shrink-0">
                      {flower.points} pts
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[#4A3550]/65">
                    <span>{flower.originNote}</span>
                    {isUnlocked && mergeCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">Merged {mergeCount}x</span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#4A3550]/85">
                    {isUnlocked
                      ? flower.funFact
                      : 'Merge matching flowers in your pot to unlock this bloom and its botanical story.'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
