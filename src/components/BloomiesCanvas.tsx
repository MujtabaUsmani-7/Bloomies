import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import Matter from 'matter-js';
import {
  COMBO_WINDOW_MS,
  DANGER_LINE_Y,
  DROPPER_Y,
  FLOWER_STAGES,
  OVERFLOW_LIMIT_SECONDS,
  PLAYFIELD_HEIGHT,
  PLAYFIELD_WIDTH,
  POT_TOP_Y,
  POT_WALL_THICKNESS,
} from '../game/flowers';
import { createSeededRng, getTodayDateKey, pickDropStage } from '../game/daily';
import { drawFlower, drawPotAndBackdrop } from '../game/renderer';
import { soundEngine } from '../game/sound';
import { GameMode, GameState, HudSnapshot, PotSkinDef, PowerUpType } from '../game/types';

interface FlowerEntity {
  body: Matter.Body;
  stage: number;
  bornAt: number;
  squishX: number;
  squishY: number;
  squishVelX: number;
  squishVelY: number;
  merging: boolean;
}

interface PetalParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  rot: number;
  vRot: number;
  kind: 'petal' | 'rain' | 'ring';
}

interface FloatingCallout {
  x: number;
  y: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface BloomiesCanvasHandle {
  resetRun: (mode: GameMode) => void;
  applyRain: () => boolean;
  grantSecondChance: () => void;
}

interface BloomiesCanvasProps {
  gameState: GameState;
  mode: GameMode;
  skin: PotSkinDef;
  activePowerUp: PowerUpType | null;
  onCancelPowerUp: () => void;
  onConsumePowerUp: (type: PowerUpType) => void;
  onHudUpdate: (hud: HudSnapshot) => void;
  onFlowerDiscovered: (stage: number, isNewMerge: boolean, coinsEarned: number) => void;
  onGameOver: (finalHud: HudSnapshot) => void;
}

export const BloomiesCanvas = forwardRef<BloomiesCanvasHandle, BloomiesCanvasProps>(
  function BloomiesCanvas(
    {
      gameState,
      mode,
      skin,
      activePowerUp,
      onCancelPowerUp,
      onConsumePowerUp,
      onHudUpdate,
      onFlowerDiscovered,
      onGameOver,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Keep fresh callbacks & props in refs for the 60fps loop
    const propsRef = useRef({
      gameState,
      mode,
      skin,
      activePowerUp,
      onCancelPowerUp,
      onConsumePowerUp,
      onHudUpdate,
      onFlowerDiscovered,
      onGameOver,
    });
    propsRef.current = {
      gameState,
      mode,
      skin,
      activePowerUp,
      onCancelPowerUp,
      onConsumePowerUp,
      onHudUpdate,
      onFlowerDiscovered,
      onGameOver,
    };

    const simRef = useRef<{
      engine: Matter.Engine;
      flowers: Map<number, FlowerEntity>;
      particles: PetalParticle[];
      callouts: FloatingCallout[];
      rng: () => number;
      aimX: number;
      currentStage: number;
      queuedStage: number;
      lastDropAt: number;
      dropCount: number;
      score: number;
      combo: number;
      maxCombo: number;
      lastMergeAt: number;
      highestStage: number;
      mergesThisRun: number;
      dangerSeconds: number;
      shakeIntensity: number;
      selectedBeeBodyId: number | null;
      gameOverTriggered: boolean;
      pendingMerges: Array<[number, number]>;
    } | null>(null);

    const spawnBurst = (
      x: number,
      y: number,
      colorA: string,
      colorB: string,
      count = 14,
      kind: 'petal' | 'rain' = 'petal'
    ) => {
      const sim = simRef.current;
      if (!sim) return;

      if (kind === 'petal') {
        sim.particles.push({
          x,
          y,
          vx: 0,
          vy: 0,
          size: 14,
          color: colorA,
          alpha: 0.75,
          life: 0,
          maxLife: 340,
          rot: 0,
          vRot: 0,
          kind: 'ring',
        });
      }

      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = kind === 'rain' ? 2 + Math.random() * 3 : 1.5 + Math.random() * 4.2;
        sim.particles.push({
          x: kind === 'rain' ? x + (Math.random() - 0.5) * 26 : x,
          y: kind === 'rain' ? y - 20 : y,
          vx: kind === 'rain' ? 0 : Math.cos(ang) * speed,
          vy: kind === 'rain' ? 4 + Math.random() * 3 : Math.sin(ang) * speed - 1.2,
          size: kind === 'rain' ? 5 : 4 + Math.random() * 5,
          color: i % 2 === 0 ? colorA : colorB,
          alpha: 1,
          life: 0,
          maxLife: 460 + Math.random() * 240,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.22,
          kind,
        });
      }
    };

    const createFlowerBody = (stage: number, x: number, y: number, isMergedSpawn = false): FlowerEntity => {
      const def = FLOWER_STAGES[stage] || FLOWER_STAGES[0];
      const body = Matter.Bodies.circle(x, y, def.radius, {
        restitution: 0.22,
        friction: 0.26,
        frictionAir: 0.012,
        density: 0.0018 + stage * 0.00018,
        label: `flower_${stage}`,
      });
      return {
        body,
        stage,
        bornAt: performance.now(),
        squishX: isMergedSpawn ? 1.32 : 1.15,
        squishY: isMergedSpawn ? 0.72 : 0.86,
        squishVelX: 0,
        squishVelY: 0,
        merging: false,
      };
    };

    const pushHud = () => {
      const sim = simRef.current;
      if (!sim) return;
      propsRef.current.onHudUpdate({
        score: sim.score,
        combo: sim.combo,
        maxCombo: sim.maxCombo,
        highestStage: sim.highestStage,
        nextStage: sim.currentStage,
        queuedStage: sim.queuedStage,
        dangerSeconds: sim.dangerSeconds,
        isDanger: sim.dangerSeconds > 0.15,
        dropCount: sim.dropCount,
        mergesThisRun: sim.mergesThisRun,
      });
    };

    const initWorld = (targetMode: GameMode) => {
      const engine = Matter.Engine.create({
        gravity: { x: 0, y: 1.48, scale: 0.001 },
        positionIterations: 10,
        velocityIterations: 8,
      });

      const wall = POT_WALL_THICKNESS;
      const wallOpts: Matter.IChamferableBodyDefinition = {
        isStatic: true,
        restitution: 0.2,
        friction: 0.35,
        label: 'wall',
      };

      const leftWall = Matter.Bodies.rectangle(wall / 2, PLAYFIELD_HEIGHT / 2 + 40, wall, PLAYFIELD_HEIGHT, wallOpts);
      const rightWall = Matter.Bodies.rectangle(
        PLAYFIELD_WIDTH - wall / 2,
        PLAYFIELD_HEIGHT / 2 + 40,
        wall,
        PLAYFIELD_HEIGHT,
        wallOpts
      );
      const bottomFloor = Matter.Bodies.rectangle(
        PLAYFIELD_WIDTH / 2,
        PLAYFIELD_HEIGHT - wall / 2 - 3,
        PLAYFIELD_WIDTH,
        wall + 6,
        wallOpts
      );

      // Gentle bottom corner wedges so tiny seeds don't trap in corners
      const cornerOpts: Matter.IChamferableBodyDefinition = {
        isStatic: true,
        angle: Math.PI / 4,
        restitution: 0.2,
        friction: 0.2,
        label: 'wall',
      };
      const leftCorner = Matter.Bodies.rectangle(wall + 2, PLAYFIELD_HEIGHT - wall - 4, 24, 24, cornerOpts);
      const rightCorner = Matter.Bodies.rectangle(
        PLAYFIELD_WIDTH - wall - 2,
        PLAYFIELD_HEIGHT - wall - 4,
        24,
        24,
        cornerOpts
      );

      Matter.World.add(engine.world, [leftWall, rightWall, bottomFloor, leftCorner, rightCorner]);

      const rng =
        targetMode === 'daily'
          ? createSeededRng(`bloomies_daily_${getTodayDateKey()}`)
          : () => Math.random();

      const first = pickDropStage(rng, 0, 0);
      const second = pickDropStage(rng, 1, 0);

      const flowers = new Map<number, FlowerEntity>();
      const pendingMerges: Array<[number, number]> = [];

      Matter.Events.on(engine, 'collisionStart', (event) => {
        const sim = simRef.current;
        if (!sim) return;

        for (const pair of event.pairs) {
          const fa = sim.flowers.get(pair.bodyA.id);
          const fb = sim.flowers.get(pair.bodyB.id);

          if (fa && fb) {
            if (!fa.merging && !fb.merging && fa.stage === fb.stage) {
              fa.merging = true;
              fb.merging = true;
              sim.pendingMerges.push([pair.bodyA.id, pair.bodyB.id]);
            } else {
              // Gentle squishy bounce on touch
              const relSpeed = Math.hypot(
                pair.bodyA.velocity.x - pair.bodyB.velocity.x,
                pair.bodyA.velocity.y - pair.bodyB.velocity.y
              );
              if (relSpeed > 1.2) {
                const amt = Math.min(0.14, relSpeed * 0.025);
                fa.squishX = Math.max(0.84, fa.squishX - amt);
                fa.squishY = Math.min(1.16, fa.squishY + amt);
                fb.squishX = Math.max(0.84, fb.squishX - amt);
                fb.squishY = Math.min(1.16, fb.squishY + amt);
              }
            }
          } else if (fa || fb) {
            const ent = fa || fb;
            if (ent) {
              const spd = Math.hypot(ent.body.velocity.x, ent.body.velocity.y);
              if (spd > 1.8) {
                const amt = Math.min(0.16, spd * 0.022);
                ent.squishX = Math.min(1.18, ent.squishX + amt);
                ent.squishY = Math.max(0.82, ent.squishY - amt);
              }
            }
          }
        }
      });

      simRef.current = {
        engine,
        flowers,
        particles: [],
        callouts: [],
        rng,
        aimX: PLAYFIELD_WIDTH / 2,
        currentStage: first,
        queuedStage: second,
        lastDropAt: 0,
        dropCount: 0,
        score: 0,
        combo: 1,
        maxCombo: 1,
        lastMergeAt: 0,
        highestStage: 0,
        mergesThisRun: 0,
        dangerSeconds: 0,
        shakeIntensity: 0,
        selectedBeeBodyId: null,
        gameOverTriggered: false,
        pendingMerges,
      };

      pushHud();
    };

    const performMerge = (idA: number, idB: number) => {
      const sim = simRef.current;
      if (!sim) return;
      const fa = sim.flowers.get(idA);
      const fb = sim.flowers.get(idB);
      if (!fa || !fb) return;

      const stage = fa.stage;
      const midX = (fa.body.position.x + fb.body.position.x) / 2;
      const midY = (fa.body.position.y + fb.body.position.y) / 2;

      Matter.World.remove(sim.engine.world, [fa.body, fb.body]);
      sim.flowers.delete(idA);
      sim.flowers.delete(idB);

      const now = performance.now();
      if (now - sim.lastMergeAt <= COMBO_WINDOW_MS) {
        sim.combo += 1;
      } else {
        sim.combo = 1;
      }
      sim.lastMergeAt = now;
      sim.maxCombo = Math.max(sim.maxCombo, sim.combo);
      sim.mergesThisRun += 1;

      if (stage >= 10) {
        // Two Golden Lotuses combined: celebratory Golden Supernova!
        const bonus = 2500 * sim.combo;
        sim.score += bonus;
        sim.shakeIntensity = Math.max(sim.shakeIntensity, 6);
        spawnBurst(midX, midY, '#FFD93D', '#FFF1A8', 28, 'petal');
        sim.callouts.push({
          x: midX,
          y: midY - 10,
          text: `+${bonus.toLocaleString()}`,
          subtext: 'GOLDEN SUPERNOVA!',
          color: '#B87400',
          life: 0,
          maxLife: 1300,
        });
        soundEngine.playMerge(10, sim.combo + 1);
        propsRef.current.onFlowerDiscovered(10, true, 25);
        pushHud();
        return;
      }

      const nextStage = stage + 1;
      const nextDef = FLOWER_STAGES[nextStage];
      const clampedX = Math.max(
        POT_WALL_THICKNESS + nextDef.radius + 2,
        Math.min(PLAYFIELD_WIDTH - POT_WALL_THICKNESS - nextDef.radius - 2, midX)
      );
      const clampedY = Math.min(PLAYFIELD_HEIGHT - POT_WALL_THICKNESS - nextDef.radius - 4, midY);

      const merged = createFlowerBody(nextStage, clampedX, clampedY, true);
      Matter.Body.setVelocity(merged.body, { x: 0, y: -1.8 });
      Matter.World.add(sim.engine.world, merged.body);
      sim.flowers.set(merged.body.id, merged);

      // Gentle outward impulse wave for organic chain reactions
      const blastRadius = nextDef.radius * 2.5;
      sim.flowers.forEach((other) => {
        if (other.body.id === merged.body.id) return;
        const dx = other.body.position.x - clampedX;
        const dy = other.body.position.y - clampedY;
        const dist = Math.hypot(dx, dy);
        if (dist > 1 && dist < blastRadius) {
          const forceMag = (1 - dist / blastRadius) * 0.015 * other.body.mass;
          Matter.Body.applyForce(other.body, other.body.position, {
            x: (dx / dist) * forceMag,
            y: (dy / dist) * forceMag - 0.002,
          });
        }
      });

      const earnedPts = nextDef.points * sim.combo;
      sim.score += earnedPts;
      sim.highestStage = Math.max(sim.highestStage, nextStage);

      if (sim.combo >= 2) {
        sim.shakeIntensity = Math.min(5, sim.combo * 1.1);
      }

      spawnBurst(clampedX, clampedY, nextDef.primaryColor, nextDef.centerColor, 14 + nextStage, 'petal');
      sim.callouts.push({
        x: clampedX,
        y: clampedY - nextDef.radius * 0.4,
        text: `+${earnedPts}`,
        subtext: sim.combo >= 2 ? `x${sim.combo} COMBO!` : nextStage >= 6 ? nextDef.name : undefined,
        color: sim.combo >= 2 ? '#D6286B' : '#4A3550',
        life: 0,
        maxLife: 920,
      });

      soundEngine.playMerge(nextStage, sim.combo);
      const coinsEarned = nextStage >= 5 ? 3 : nextStage >= 3 ? 1 : 0;
      propsRef.current.onFlowerDiscovered(nextStage, true, coinsEarned);
      pushHud();
    };

    useImperativeHandle(ref, () => ({
      resetRun(newMode: GameMode) {
        initWorld(newMode);
      },

      applyRain() {
        const sim = simRef.current;
        if (!sim || sim.flowers.size === 0) return false;

        // Target Seeds & Sprouts first; if none, target lowest stage present
        let targets = Array.from(sim.flowers.values()).filter((f) => f.stage <= 1);
        if (targets.length === 0) {
          let minStage = 10;
          sim.flowers.forEach((f) => {
            if (f.stage < minStage) minStage = f.stage;
          });
          if (minStage >= 9) return false;
          targets = Array.from(sim.flowers.values()).filter((f) => f.stage === minStage).slice(0, 3);
        }

        if (targets.length === 0) return false;

        for (const ent of targets) {
          spawnBurst(ent.body.position.x, ent.body.position.y, '#8EC9FF', '#BDE0FE', 10, 'rain');
          Matter.World.remove(sim.engine.world, ent.body);
          sim.flowers.delete(ent.body.id);
        }

        sim.dangerSeconds = Math.max(0, sim.dangerSeconds - 1.5);
        sim.callouts.push({
          x: PLAYFIELD_WIDTH / 2,
          y: POT_TOP_Y + 48,
          text: `Cleared ${targets.length} small blooms!`,
          color: '#256D9E',
          life: 0,
          maxLife: 1100,
        });
        soundEngine.playPowerUp('rain');
        pushHud();
        return true;
      },

      grantSecondChance() {
        const sim = simRef.current;
        if (!sim) return;
        const clearThresholdY = DANGER_LINE_Y + 115;
        const toClear: FlowerEntity[] = [];
        sim.flowers.forEach((f) => {
          if (f.body.position.y < clearThresholdY) {
            toClear.push(f);
          }
        });
        // If somehow none were strictly above threshold, clear 3 highest flowers
        if (toClear.length === 0) {
          const sorted = Array.from(sim.flowers.values()).sort(
            (a, b) => a.body.position.y - b.body.position.y
          );
          toClear.push(...sorted.slice(0, 3));
        }

        for (const ent of toClear) {
          spawnBurst(ent.body.position.x, ent.body.position.y, '#FFD93D', '#FF7EB6', 12, 'petal');
          Matter.World.remove(sim.engine.world, ent.body);
          sim.flowers.delete(ent.body.id);
        }
        sim.dangerSeconds = 0;
        sim.gameOverTriggered = false;
        soundEngine.playPowerUp('sunshine');
        pushHud();
      },
    }));

    // Initialize world on first mount
    useEffect(() => {
      initWorld(mode);
    }, []);

    // Main 60fps animation & physics loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let rafId = 0;
      let lastTime = performance.now();
      let hudAccumulator = 0;

      const tick = (now: number) => {
        rafId = requestAnimationFrame(tick);
        const dtMs = Math.min(32, now - lastTime);
        lastTime = now;

        const sim = simRef.current;
        if (!sim) return;

        const { gameState: curState, skin: curSkin, activePowerUp: curPowerUp } = propsRef.current;

        // Resize canvas cleanly for Retina DPR
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = PLAYFIELD_WIDTH * dpr;
        const targetH = PLAYFIELD_HEIGHT * dpr;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        // Step physics only while PLAYING
        if (curState === 'PLAYING' && !sim.gameOverTriggered) {
          Matter.Engine.update(sim.engine, dtMs);

          // Resolve queued merges outside Matter step
          if (sim.pendingMerges.length > 0) {
            const batch = sim.pendingMerges.splice(0, sim.pendingMerges.length);
            for (const [idA, idB] of batch) {
              performMerge(idA, idB);
            }
          }

          // Combo decay check
          if (sim.combo > 1 && now - sim.lastMergeAt > COMBO_WINDOW_MS) {
            sim.combo = 1;
          }

          // 3-Second Overflow Rule check
          let overflowing = false;
          sim.flowers.forEach((f) => {
            if (now - f.bornAt > 1150) {
              const r = FLOWER_STAGES[f.stage].radius;
              if (f.body.position.y - r < DANGER_LINE_Y) {
                overflowing = true;
              }
            }
          });

          if (overflowing) {
            sim.dangerSeconds += dtMs / 1000;
            if (sim.dangerSeconds >= OVERFLOW_LIMIT_SECONDS) {
              sim.dangerSeconds = OVERFLOW_LIMIT_SECONDS;
              sim.gameOverTriggered = true;
              soundEngine.playGameOver();
              pushHud();
              propsRef.current.onGameOver({
                score: sim.score,
                combo: sim.combo,
                maxCombo: sim.maxCombo,
                highestStage: sim.highestStage,
                nextStage: sim.currentStage,
                queuedStage: sim.queuedStage,
                dangerSeconds: sim.dangerSeconds,
                isDanger: true,
                dropCount: sim.dropCount,
                mergesThisRun: sim.mergesThisRun,
              });
            }
          } else {
            sim.dangerSeconds = Math.max(0, sim.dangerSeconds - (dtMs / 1000) * 1.8);
          }
        }

        // Update squish springs, particles, callouts, shake
        sim.flowers.forEach((f) => {
          const k = 0.18;
          const damp = 0.72;
          f.squishVelX = (f.squishVelX + (1 - f.squishX) * k) * damp;
          f.squishVelY = (f.squishVelY + (1 - f.squishY) * k) * damp;
          f.squishX += f.squishVelX;
          f.squishY += f.squishVelY;
        });

        for (let i = sim.particles.length - 1; i >= 0; i--) {
          const p = sim.particles[i];
          p.life += dtMs;
          if (p.life >= p.maxLife) {
            sim.particles.splice(i, 1);
            continue;
          }
          const t = p.life / p.maxLife;
          if (p.kind === 'ring') {
            p.size += dtMs * 0.16;
            p.alpha = 1 - t;
          } else {
            p.x += p.vx;
            p.y += p.vy;
            if (p.kind === 'petal') p.vy += 0.08;
            p.rot += p.vRot;
            p.alpha = 1 - t;
          }
        }

        for (let i = sim.callouts.length - 1; i >= 0; i--) {
          const c = sim.callouts[i];
          c.life += dtMs;
          c.y -= dtMs * 0.032;
          if (c.life >= c.maxLife) {
            sim.callouts.splice(i, 1);
          }
        }

        sim.shakeIntensity *= 0.85;
        if (sim.shakeIntensity < 0.15) sim.shakeIntensity = 0;

        // Periodic HUD sync for danger countdown
        hudAccumulator += dtMs;
        if (hudAccumulator > 80) {
          hudAccumulator = 0;
          pushHud();
        }

        // Render frame
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT);

        ctx.save();
        if (!prefersReducedMotion && sim.shakeIntensity > 0) {
          ctx.translate(
            (Math.random() - 0.5) * sim.shakeIntensity * 2,
            (Math.random() - 0.5) * sim.shakeIntensity * 2
          );
        }

        // 1. Pot interior, danger line & walls
        drawPotAndBackdrop(ctx, curSkin, sim.dangerSeconds / OVERFLOW_LIMIT_SECONDS, now);

        // 2. Dropper aim guide & hovering flower
        if (curState === 'PLAYING' && !curPowerUp) {
          const dropDef = FLOWER_STAGES[sim.currentStage];
          const minX = POT_WALL_THICKNESS + dropDef.radius + 4;
          const maxX = PLAYFIELD_WIDTH - POT_WALL_THICKNESS - dropDef.radius - 4;
          const clampedAimX = Math.max(minX, Math.min(maxX, sim.aimX));

          // Vertical guide line
          ctx.save();
          ctx.strokeStyle = 'rgba(74, 53, 80, 0.22)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(clampedAimX, DROPPER_Y + dropDef.radius + 4);
          ctx.lineTo(clampedAimX, PLAYFIELD_HEIGHT - POT_WALL_THICKNESS - 10);
          ctx.stroke();
          ctx.restore();

          // Waiting flower bobbing gently at dropper
          const canDrop = now - sim.lastDropAt >= 360;
          ctx.save();
          ctx.globalAlpha = canDrop ? 1 : 0.45;
          drawFlower(ctx, sim.currentStage, clampedAimX, DROPPER_Y, dropDef.radius, 0, 1, 1, now, false);
          ctx.restore();
        }

        // 3. Active physics flowers
        sim.flowers.forEach((f) => {
          const def = FLOWER_STAGES[f.stage];
          const isBeeSelected = curPowerUp === 'bee' && sim.selectedBeeBodyId === f.body.id;
          const isTargetable =
            (curPowerUp === 'bee' && !isBeeSelected) || (curPowerUp === 'sunshine' && f.stage < 10);

          drawFlower(
            ctx,
            f.stage,
            f.body.position.x,
            f.body.position.y,
            def.radius,
            f.body.angle,
            f.squishX,
            f.squishY,
            now,
            isBeeSelected
          );

          if (isTargetable) {
            ctx.save();
            ctx.strokeStyle = curPowerUp === 'sunshine' ? 'rgba(255, 217, 61, 0.7)' : 'rgba(142, 201, 255, 0.75)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(f.body.position.x, f.body.position.y, def.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        });

        // 4. Petal & rain particles
        for (const p of sim.particles) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          if (p.kind === 'ring') {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.stroke();
          } else if (p.kind === 'rain') {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x, p.y + p.size * 2.2);
            ctx.stroke();
          } else {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 5. Floating score / combo callouts
        for (const c of sim.callouts) {
          const alpha = 1 - Math.pow(c.life / c.maxLife, 2);
          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.textAlign = 'center';
          ctx.font = '700 18px "Bricolage Grotesque", sans-serif';
          ctx.fillStyle = c.color;
          ctx.fillText(c.text, c.x, c.y);
          if (c.subtext) {
            ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#D6286B';
            ctx.fillText(c.subtext, c.x, c.y - 18);
          }
          ctx.restore();
        }

        // 6. Danger countdown pill inside top rim if overflowing
        if (sim.dangerSeconds > 0.25 && curState === 'PLAYING') {
          const rem = Math.max(0, OVERFLOW_LIMIT_SECONDS - sim.dangerSeconds);
          ctx.save();
          ctx.fillStyle = 'rgba(214, 40, 75, 0.92)';
          ctx.beginPath();
          ctx.roundRect(PLAYFIELD_WIDTH / 2 - 64, DANGER_LINE_Y - 30, 128, 24, 12);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.fillText(`OVERFLOW ${rem.toFixed(1)}s`, PLAYFIELD_WIDTH / 2, DANGER_LINE_Y - 14);
          ctx.restore();
        }

        ctx.restore();
      };

      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }, []);

    // Coordinate helper
    const getCanvasPoint = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: PLAYFIELD_WIDTH / 2, y: DROPPER_Y };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * PLAYFIELD_WIDTH,
        y: ((clientY - rect.top) / rect.height) * PLAYFIELD_HEIGHT,
      };
    };

    const findFlowerAt = (x: number, y: number): FlowerEntity | null => {
      const sim = simRef.current;
      if (!sim) return null;
      let hit: FlowerEntity | null = null;
      let bestDist = Infinity;
      sim.flowers.forEach((f) => {
        const r = FLOWER_STAGES[f.stage].radius;
        const d = Math.hypot(f.body.position.x - x, f.body.position.y - y);
        if (d <= r + 8 && d < bestDist) {
          bestDist = d;
          hit = f;
        }
      });
      return hit;
    };

    const dropCurrentFlower = (targetX: number) => {
      const sim = simRef.current;
      if (!sim || propsRef.current.gameState !== 'PLAYING' || sim.gameOverTriggered) return;

      const now = performance.now();
      if (now - sim.lastDropAt < 360) return;

      const def = FLOWER_STAGES[sim.currentStage];
      const minX = POT_WALL_THICKNESS + def.radius + 4;
      const maxX = PLAYFIELD_WIDTH - POT_WALL_THICKNESS - def.radius - 4;
      const clampedX = Math.max(minX, Math.min(maxX, targetX));

      const entity = createFlowerBody(sim.currentStage, clampedX, DROPPER_Y, false);
      Matter.World.add(sim.engine.world, entity.body);
      sim.flowers.set(entity.body.id, entity);

      sim.lastDropAt = now;
      sim.dropCount += 1;
      sim.aimX = clampedX;

      soundEngine.playDrop();
      propsRef.current.onFlowerDiscovered(sim.currentStage, false, 0);

      sim.currentStage = sim.queuedStage;
      sim.queuedStage = pickDropStage(sim.rng, sim.dropCount + 1, sim.highestStage);
      pushHud();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const sim = simRef.current;
      if (!sim || propsRef.current.gameState !== 'PLAYING') return;
      const pt = getCanvasPoint(e.clientX, e.clientY);
      sim.aimX = pt.x;
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const sim = simRef.current;
      if (!sim || propsRef.current.gameState !== 'PLAYING' || sim.gameOverTriggered) return;

      const pt = getCanvasPoint(e.clientX, e.clientY);
      sim.aimX = pt.x;

      const activePU = propsRef.current.activePowerUp;
      if (activePU === 'sunshine') {
        const hit = findFlowerAt(pt.x, pt.y);
        if (hit && hit.stage < 10) {
          const nextStage = hit.stage + 1;
          const nextDef = FLOWER_STAGES[nextStage];
          const px = Math.max(
            POT_WALL_THICKNESS + nextDef.radius + 2,
            Math.min(PLAYFIELD_WIDTH - POT_WALL_THICKNESS - nextDef.radius - 2, hit.body.position.x)
          );
          const py = Math.min(PLAYFIELD_HEIGHT - POT_WALL_THICKNESS - nextDef.radius - 4, hit.body.position.y);

          Matter.World.remove(sim.engine.world, hit.body);
          sim.flowers.delete(hit.body.id);

          const upgraded = createFlowerBody(nextStage, px, py, true);
          Matter.World.add(sim.engine.world, upgraded.body);
          sim.flowers.set(upgraded.body.id, upgraded);

          sim.score += nextDef.points;
          sim.highestStage = Math.max(sim.highestStage, nextStage);
          spawnBurst(px, py, '#FFD93D', nextDef.primaryColor, 18, 'petal');
          sim.callouts.push({
            x: px,
            y: py - nextDef.radius * 0.5,
            text: `+${nextDef.points}`,
            subtext: `SUNSHINE! ${nextDef.name}`,
            color: '#B87400',
            life: 0,
            maxLife: 1000,
          });
          soundEngine.playPowerUp('sunshine');
          propsRef.current.onFlowerDiscovered(nextStage, true, 2);
          propsRef.current.onConsumePowerUp('sunshine');
          pushHud();
        }
        return;
      }

      if (activePU === 'bee') {
        const hit = findFlowerAt(pt.x, pt.y);
        if (!hit) return;

        if (sim.selectedBeeBodyId === null) {
          sim.selectedBeeBodyId = hit.body.id;
          return;
        }
        if (sim.selectedBeeBodyId === hit.body.id) {
          sim.selectedBeeBodyId = null;
          return;
        }

        const first = sim.flowers.get(sim.selectedBeeBodyId);
        if (!first) {
          sim.selectedBeeBodyId = hit.body.id;
          return;
        }

        const posA = { x: first.body.position.x, y: first.body.position.y };
        const posB = { x: hit.body.position.x, y: hit.body.position.y };

        Matter.Body.setPosition(first.body, posB);
        Matter.Body.setVelocity(first.body, { x: 0, y: 0 });
        Matter.Body.setPosition(hit.body, posA);
        Matter.Body.setVelocity(hit.body, { x: 0, y: 0 });

        first.squishX = 1.24;
        first.squishY = 0.78;
        hit.squishX = 1.24;
        hit.squishY = 0.78;

        spawnBurst(posA.x, posA.y, '#8EC9FF', '#FFD93D', 10, 'petal');
        spawnBurst(posB.x, posB.y, '#8EC9FF', '#FFD93D', 10, 'petal');
        soundEngine.playPowerUp('bee');
        sim.selectedBeeBodyId = null;
        propsRef.current.onConsumePowerUp('bee');
        return;
      }

      // On mouse click, drop on pointerup; on touch, drag then release to drop!
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const sim = simRef.current;
      if (!sim || propsRef.current.gameState !== 'PLAYING') return;
      if (propsRef.current.activePowerUp) return;
      const pt = getCanvasPoint(e.clientX, e.clientY);
      dropCurrentFlower(pt.x);
    };

    // Cancel lingering Bee selection if power-up cancelled
    useEffect(() => {
      if (activePowerUp !== 'bee' && simRef.current) {
        simRef.current.selectedBeeBodyId = null;
      }
    }, [activePowerUp]);

    return (
      <div className="relative select-none touch-none">
        {activePowerUp && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#4A3550]/15 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#4A3550] shadow-sm">
            <span>
              {activePowerUp === 'bee'
                ? 'Bee active: Tap two flowers to swap them.'
                : 'Sunshine active: Tap any flower to bloom it +1 stage.'}
            </span>
            <button
              type="button"
              onClick={onCancelPowerUp}
              className="rounded-lg bg-[#4A3550]/10 px-2.5 py-1 text-xs font-bold text-[#4A3550] hover:bg-[#4A3550]/20 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
          </div>
        )}
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className="block w-full max-w-[420px] aspect-[420/600] rounded-3xl touch-none cursor-crosshair"
          aria-label="Bloomies garden pot playfield"
        />
      </div>
    );
  }
);
