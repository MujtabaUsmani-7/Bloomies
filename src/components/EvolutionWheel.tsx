import { FLOWER_STAGES } from '../game/flowers';
import { FlowerThumbnail } from './FlowerThumbnail';

interface EvolutionWheelProps {
  unlockedStages: number[];
  currentHighestStage: number;
}

export function EvolutionWheel({ unlockedStages, currentHighestStage }: EvolutionWheelProps) {
  const unlockedSet = new Set(unlockedStages);

  return (
    <div className="rounded-3xl border border-[#4A3550]/10 bg-white/75 p-5 shadow-xs">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-[#4A3550]">Evolution Chain</h2>
        <span className="text-xs font-medium text-[#4A3550]/65 tabular-nums">
          11 Stages
        </span>
      </div>
      <p className="mt-1 text-xs text-[#4A3550]/70">
        Match identical blooms to grow toward the Golden Lotus.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-4 lg:grid-cols-3">
        {FLOWER_STAGES.map((flower) => {
          const isUnlocked = unlockedSet.has(flower.stage) || flower.stage <= currentHighestStage;
          const isCurrentTop = flower.stage === currentHighestStage && currentHighestStage > 0;
          return (
            <div
              key={flower.id}
              className={`flex flex-col items-center rounded-2xl border p-2 text-center transition-colors ${
                isCurrentTop
                  ? 'border-[#FFD93D] bg-[#FFFBEB]'
                  : isUnlocked
                    ? 'border-[#4A3550]/8 bg-[#FFFDFB]'
                    : 'border-dashed border-[#4A3550]/12 bg-white/40'
              }`}
              title={`${flower.name} (${flower.points} pts)`}
            >
              <FlowerThumbnail stage={flower.stage} size={40} locked={!isUnlocked} />
              <span className="mt-1 w-full truncate text-[11px] font-semibold text-[#4A3550]">
                {flower.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
