import { Check, Coins, Sparkles, X } from 'lucide-react';
import { POT_SKINS, POWER_UP_META } from '../game/flowers';
import { PlayerProgress, PotSkinId, PowerUpType } from '../game/types';

interface PotSkinsModalProps {
  open: boolean;
  progress: PlayerProgress;
  onSelectSkin: (skinId: PotSkinId) => void;
  onBuySkin: (skinId: PotSkinId, cost: number) => void;
  onBuyPowerUp: (type: PowerUpType, cost: number) => void;
  onClaimGardenGift: () => void;
  onClose: () => void;
}

export function PotSkinsModal({
  open,
  progress,
  onSelectSkin,
  onBuySkin,
  onBuyPowerUp,
  onClaimGardenGift,
  onClose,
}: PotSkinsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#4A3550]/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pot-skins-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#4A3550]/12 bg-[#FFF8F2] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#4A3550]/10 px-6 py-4">
          <div>
            <h2 id="pot-skins-title" className="font-display text-2xl font-bold text-[#4A3550]">
              Pots & Garden Shop
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[#4A3550]/75 tabular-nums">
              <Coins className="h-4 w-4 text-[#D99B00]" />
              <span>{progress.coins.toLocaleString()} Blossom Coins available</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4A3550]/10 bg-white text-[#4A3550] transition-colors hover:bg-[#FFF1E6]"
            aria-label="Close pots and shop"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto p-6">
          {/* Pot Skins Section */}
          <div>
            <h3 className="font-display text-lg font-bold text-[#4A3550]">Garden Pots</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {POT_SKINS.map((skin) => {
                const isUnlocked = progress.unlockedSkins.includes(skin.id);
                const isSelected = progress.selectedSkin === skin.id;
                const canAfford = progress.coins >= skin.cost;

                return (
                  <div
                    key={skin.id}
                    className={`flex flex-col justify-between rounded-2xl border p-4 transition-colors ${
                      isSelected
                        ? 'border-[#FF7EB6] bg-white shadow-sm'
                        : 'border-[#4A3550]/10 bg-white/85'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="h-12 w-12 shrink-0 rounded-xl border border-[#4A3550]/15 shadow-inner"
                        style={{
                          background: `linear-gradient(135deg, ${skin.potRimColor}, ${skin.potColor})`,
                        }}
                      />
                      <div className="min-w-0">
                        <h4 className="font-display text-base font-bold text-[#4A3550]">
                          {skin.name}
                        </h4>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#4A3550]/75">
                          {skin.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4A3550]">
                          <Check className="h-4 w-4 text-[#439A6C]" />
                          Equipped
                        </span>
                      ) : isUnlocked ? (
                        <button
                          type="button"
                          onClick={() => onSelectSkin(skin.id)}
                          className="rounded-xl bg-[#8EC9FF]/35 px-4 py-2 text-xs font-bold text-[#4A3550] transition-colors hover:bg-[#8EC9FF]/55 whitespace-nowrap shrink-0"
                        >
                          Equip Pot
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuySkin(skin.id, skin.cost)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                            canAfford
                              ? 'bg-[#FF7EB6] text-[#4A3550] hover:bg-[#ff6aa9]'
                              : 'cursor-not-allowed bg-[#4A3550]/10 text-[#4A3550]/45'
                          }`}
                        >
                          <Coins className="h-3.5 w-3.5" />
                          Unlock · {skin.cost}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#4A3550]/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-[#4A3550]">Power-Up Supplies</h3>
              <button
                type="button"
                onClick={onClaimGardenGift}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFD93D] px-3.5 py-2 text-xs font-bold text-[#4A3550] transition-transform hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Watch Ad · +50 Coins
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(['rain', 'bee', 'sunshine'] as PowerUpType[]).map((key) => {
                const meta = POWER_UP_META[key];
                const count = progress.powerUps[key];
                const canAfford = progress.coins >= meta.cost;
                return (
                  <div
                    key={key}
                    className="flex flex-col justify-between rounded-2xl border border-[#4A3550]/10 bg-white p-4"
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="font-display text-base font-bold text-[#4A3550]">
                          {meta.name}
                        </h4>
                        <span className="text-xs font-semibold text-[#4A3550]/65 tabular-nums">
                          Owned: {count}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#4A3550]/75">{meta.shortDesc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyPowerUp(key, meta.cost)}
                      className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                        canAfford
                          ? 'bg-[#FF7EB6] text-[#4A3550] hover:bg-[#ff6aa9]'
                          : 'cursor-not-allowed bg-[#4A3550]/10 text-[#4A3550]/45'
                      }`}
                    >
                      <Coins className="h-3.5 w-3.5" />
                      Add +1 · {meta.cost}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
