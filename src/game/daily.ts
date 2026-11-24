export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatReadableDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRng(seedStr: string): () => number {
  let a = hashString(seedStr) || 123456789;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates the next droppable flower stage (0..4: Seed..Marigold).
 * Keeps early drops forgiving so players feel clever in the first 30 seconds.
 */
export function pickDropStage(rng: () => number, dropIndex: number, highestStageReached: number): number {
  const r = rng();

  // First 5 drops: strictly Seeds, Sprouts, Buds so early merges come effortlessly
  if (dropIndex < 5) {
    if (r < 0.48) return 0;
    if (r < 0.84) return 1;
    return 2;
  }

  // Unlock Daisy in dropper once player reaches Bud or drop 6+
  if (dropIndex < 14 && highestStageReached < 5) {
    if (r < 0.36) return 0;
    if (r < 0.68) return 1;
    if (r < 0.90) return 2;
    return 3;
  }

  // Full early pool (Seed .. Marigold)
  if (r < 0.30) return 0; // Seed
  if (r < 0.58) return 1; // Sprout
  if (r < 0.80) return 2; // Bud
  if (r < 0.93) return 3; // Daisy
  return 4; // Marigold
}
