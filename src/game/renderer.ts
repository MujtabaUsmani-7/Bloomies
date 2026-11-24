import { FLOWER_STAGES, POT_TOP_Y, POT_WALL_THICKNESS, PLAYFIELD_HEIGHT, PLAYFIELD_WIDTH } from './flowers';
import { PotSkinDef } from './types';

function drawCuteFace(
  ctx: CanvasRenderingContext2D,
  r: number,
  cheekColor: string,
  eyeColor: string,
  expression: 'normal' | 'happy' | 'serene' = 'normal',
  yOffset = 0
) {
  const eyeDist = r * 0.24;
  const eyeY = yOffset - r * 0.04;
  const eyeR = Math.max(1.5, r * 0.068);

  // Rosy cheeks
  ctx.save();
  ctx.fillStyle = cheekColor;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(-eyeDist * 1.45, eyeY + r * 0.14, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
  ctx.ellipse(eyeDist * 1.45, eyeY + r * 0.14, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Eyes
  ctx.fillStyle = eyeColor;
  ctx.strokeStyle = eyeColor;
  ctx.lineWidth = Math.max(1.4, r * 0.052);
  ctx.lineCap = 'round';

  if (expression === 'happy') {
    // Happy curved arcs
    ctx.beginPath();
    ctx.arc(-eyeDist, eyeY + eyeR * 0.4, eyeR * 1.15, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eyeDist, eyeY + eyeR * 0.4, eyeR * 1.15, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  } else {
    // Two soft dots + tiny catchlight
    ctx.beginPath();
    ctx.arc(-eyeDist, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(eyeDist, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    if (r >= 20) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(-eyeDist - eyeR * 0.28, eyeY - eyeR * 0.28, eyeR * 0.34, 0, Math.PI * 2);
      ctx.arc(eyeDist - eyeR * 0.28, eyeY - eyeR * 0.28, eyeR * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cute small smile
  ctx.strokeStyle = eyeColor;
  ctx.lineWidth = Math.max(1.3, r * 0.05);
  ctx.beginPath();
  if (expression === 'serene') {
    ctx.arc(0, eyeY + r * 0.11, r * 0.13, 0.18 * Math.PI, 0.82 * Math.PI);
  } else {
    ctx.arc(0, eyeY + r * 0.09, r * 0.14, 0.14 * Math.PI, 0.86 * Math.PI);
  }
  ctx.stroke();
}

function drawScallopedRing(
  ctx: CanvasRenderingContext2D,
  petalCount: number,
  outerRadius: number,
  petalRadius: number,
  fill: string | CanvasGradient,
  stroke?: string,
  rotationOffset = 0
) {
  ctx.save();
  ctx.rotate(rotationOffset);
  ctx.fillStyle = fill;
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.6;
  }

  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2;
    const px = Math.cos(a) * outerRadius;
    const py = Math.sin(a) * outerRadius;
    ctx.beginPath();
    ctx.arc(px, py, petalRadius, 0, Math.PI * 2);
    ctx.fill();
    if (stroke) ctx.stroke();
  }
  ctx.restore();
}

export function drawFlower(
  ctx: CanvasRenderingContext2D,
  stageIndex: number,
  x: number,
  y: number,
  radius: number,
  angle = 0,
  squishX = 1,
  squishY = 1,
  timeMs = 0,
  highlightRing = false
) {
  const def = FLOWER_STAGES[stageIndex] || FLOWER_STAGES[0];
  const r = radius;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(squishX, squishY);

  // Soft ambient shadow under every flower
  ctx.save();
  ctx.shadowColor = 'rgba(74, 53, 80, 0.14)';
  ctx.shadowBlur = Math.max(4, r * 0.22);
  ctx.shadowOffsetY = Math.max(2, r * 0.08);
  ctx.fillStyle = 'rgba(74, 53, 80, 0.02)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Golden Lotus gentle aura
  if (stageIndex === 10) {
    const pulse = 1 + Math.sin(timeMs * 0.004) * 0.05;
    const halo = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.24 * pulse);
    halo.addColorStop(0, 'rgba(255, 217, 61, 0.42)');
    halo.addColorStop(1, 'rgba(255, 217, 61, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.24 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  switch (stageIndex) {
    case 0: {
      // Seed: round cozy teardrop-ish seed
      const grad = ctx.createRadialGradient(-r * 0.28, -r * 0.3, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#DFA878');
      grad.addColorStop(0.65, def.primaryColor);
      grad.addColorStop(1, def.secondaryColor);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // Tiny sprout nub on top
      ctx.fillStyle = '#89C997';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.86, r * 0.18, r * 0.26, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Belly patch
      ctx.fillStyle = 'rgba(255, 241, 230, 0.38)';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.22, r * 0.58, r * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();

      drawCuteFace(ctx, r * 0.95, def.cheekColor, '#4A3550', 'normal', r * 0.06);
      break;
    }

    case 1: {
      // Sprout: round green body + twin baby leaves
      ctx.fillStyle = '#6BCB77';
      ctx.beginPath();
      ctx.ellipse(-r * 0.42, -r * 0.72, r * 0.38, r * 0.2, -0.45, 0, Math.PI * 2);
      ctx.ellipse(r * 0.42, -r * 0.72, r * 0.38, r * 0.2, 0.45, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#C7F2D4');
      grad.addColorStop(0.6, def.primaryColor);
      grad.addColorStop(1, def.secondaryColor);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, r * 0.04, r * 0.9, 0, Math.PI * 2);
      ctx.fill();

      drawCuteFace(ctx, r * 0.92, def.cheekColor, '#37473C', 'normal', r * 0.08);
      break;
    }

    case 2: {
      // Bud: plump blush rosebud with green sepal cradle
      const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#FFD6E0');
      grad.addColorStop(0.65, def.primaryColor);
      grad.addColorStop(1, def.secondaryColor);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, -r * 0.03, r * 0.92, 0, Math.PI * 2);
      ctx.fill();

      // Top petal fold
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.beginPath();
      ctx.arc(0, -r * 0.18, r * 0.45, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();

      // Green calyx leaves
      ctx.fillStyle = '#70C188';
      ctx.beginPath();
      ctx.ellipse(-r * 0.42, r * 0.65, r * 0.42, r * 0.22, -0.35, 0, Math.PI * 2);
      ctx.ellipse(r * 0.42, r * 0.65, r * 0.42, r * 0.22, 0.35, 0, Math.PI * 2);
      ctx.fill();

      drawCuteFace(ctx, r * 0.92, def.cheekColor, '#4A3550', 'normal', -r * 0.02);
      break;
    }

    case 3: {
      // Daisy: 10 soft scalloped pink petals + sunny center
      const pGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      pGrad.addColorStop(0, '#FFC2DF');
      pGrad.addColorStop(1, def.primaryColor);
      drawScallopedRing(ctx, 10, r * 0.64, r * 0.34, pGrad, 'rgba(255, 112, 166, 0.35)');

      const cGrad = ctx.createRadialGradient(-r * 0.18, -r * 0.18, r * 0.05, 0, 0, r * 0.64);
      cGrad.addColorStop(0, '#FFF1A8');
      cGrad.addColorStop(0.7, '#FFD93D');
      cGrad.addColorStop(1, '#F6B926');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      ctx.fill();

      drawCuteFace(ctx, r * 0.8, def.cheekColor, '#4A3550', 'happy', 0);
      break;
    }

    case 4: {
      // Marigold (Genda): rich layered tangerine ruffled petals
      drawScallopedRing(ctx, 14, r * 0.68, r * 0.3, '#F77F00', 'rgba(214, 92, 0, 0.25)');
      drawScallopedRing(ctx, 11, r * 0.52, r * 0.28, '#FFA62B', undefined, 0.22);

      const cGrad = ctx.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.05, 0, 0, r * 0.56);
      cGrad.addColorStop(0, '#FFE28A');
      cGrad.addColorStop(0.75, '#FFB703');
      cGrad.addColorStop(1, '#FB8500');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.54, 0, Math.PI * 2);
      ctx.fill();

      drawCuteFace(ctx, r * 0.78, def.cheekColor, '#4A3550', 'normal', 0);
      break;
    }

    case 5: {
      // Jasmine (Mogra): creamy white 6-petal star with mint calyx accents
      drawScallopedRing(ctx, 6, r * 0.52, r * 0.24, '#80C896', undefined, Math.PI / 6);

      const pGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      pGrad.addColorStop(0, '#FFFFFF');
      pGrad.addColorStop(1, '#F3EAE2');
      drawScallopedRing(ctx, 6, r * 0.58, r * 0.4, pGrad, 'rgba(205, 190, 178, 0.5)');

      const cGrad = ctx.createRadialGradient(-r * 0.14, -r * 0.14, r * 0.05, 0, 0, r * 0.56);
      cGrad.addColorStop(0, '#FFFFFF');
      cGrad.addColorStop(0.75, '#FFF5D6');
      cGrad.addColorStop(1, '#F7D794');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
      ctx.fill();

      drawCuteFace(ctx, r * 0.76, def.cheekColor, '#4A3550', 'serene', 0);
      break;
    }

    case 6: {
      // Tulip: plump coral-peach rounded goblet petals
      // Green side leaves
      ctx.fillStyle = '#74C69D';
      ctx.beginPath();
      ctx.ellipse(-r * 0.55, r * 0.45, r * 0.36, r * 0.2, -0.55, 0, Math.PI * 2);
      ctx.ellipse(r * 0.55, r * 0.45, r * 0.36, r * 0.2, 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Back petals
      ctx.fillStyle = '#F26457';
      ctx.beginPath();
      ctx.arc(-r * 0.34, -r * 0.14, r * 0.58, 0, Math.PI * 2);
      ctx.arc(r * 0.34, -r * 0.14, r * 0.58, 0, Math.PI * 2);
      ctx.fill();

      // Center plump tulip body
      const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r * 0.9);
      grad.addColorStop(0, '#FFC0B4');
      grad.addColorStop(0.65, def.primaryColor);
      grad.addColorStop(1, def.secondaryColor);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, r * 0.05, r * 0.82, 0, Math.PI * 2);
      ctx.fill();

      // Soft petal rim highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = Math.max(2, r * 0.045);
      ctx.beginPath();
      ctx.arc(-r * 0.16, -r * 0.15, r * 0.56, Math.PI * 1.15, Math.PI * 1.65);
      ctx.stroke();

      drawCuteFace(ctx, r * 0.85, def.cheekColor, '#4A3550', 'normal', r * 0.06);
      break;
    }

    case 7: {
      // Rose (Gulab): velvet crimson-rose layered petals
      drawScallopedRing(ctx, 8, r * 0.62, r * 0.38, '#D6284B', 'rgba(158, 25, 53, 0.28)');
      drawScallopedRing(ctx, 7, r * 0.42, r * 0.35, '#FF5C77', undefined, 0.35);

      const cGrad = ctx.createRadialGradient(-r * 0.18, -r * 0.18, r * 0.08, 0, 0, r * 0.62);
      cGrad.addColorStop(0, '#FF9EB0');
      cGrad.addColorStop(0.7, '#FF5C77');
      cGrad.addColorStop(1, '#E03558');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
      ctx.fill();

      // Subtle rose swirl arc on forehead
      ctx.strokeStyle = 'rgba(255, 224, 232, 0.65)';
      ctx.lineWidth = Math.max(1.8, r * 0.04);
      ctx.beginPath();
      ctx.arc(0, -r * 0.24, r * 0.24, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      drawCuteFace(ctx, r * 0.76, '#A4133C', '#3B1826', 'happy', r * 0.04);
      break;
    }

    case 8: {
      // Sunflower: radiant yellow petals + warm cocoa face
      drawScallopedRing(ctx, 14, r * 0.68, r * 0.31, '#F4A216', undefined, 0.15);
      drawScallopedRing(ctx, 14, r * 0.64, r * 0.28, '#FFD93D', 'rgba(244, 162, 22, 0.35)');

      const cGrad = ctx.createRadialGradient(-r * 0.18, -r * 0.18, r * 0.08, 0, 0, r * 0.58);
      cGrad.addColorStop(0, '#A97142');
      cGrad.addColorStop(0.75, '#7F4F24');
      cGrad.addColorStop(1, '#582F0E');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
      ctx.fill();

      // Light eyes & warm smile on cocoa center for high contrast
      drawCuteFace(ctx, r * 0.78, '#FF8866', '#FFF8E7', 'happy', 0);
      break;
    }

    case 9: {
      // Lotus (Kamal): layered lavender-pink round rosette
      drawScallopedRing(ctx, 10, r * 0.64, r * 0.36, '#D982C8', 'rgba(176, 87, 160, 0.25)');
      drawScallopedRing(ctx, 8, r * 0.45, r * 0.35, '#F7B2E6', undefined, Math.PI / 8);

      const cGrad = ctx.createRadialGradient(-r * 0.16, -r * 0.16, r * 0.08, 0, 0, r * 0.58);
      cGrad.addColorStop(0, '#FFE6FA');
      cGrad.addColorStop(0.65, '#F8BBE9');
      cGrad.addColorStop(1, '#E088CD');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
      ctx.fill();

      drawCuteFace(ctx, r * 0.76, '#EC58B2', '#4A3550', 'serene', r * 0.02);
      break;
    }

    case 10:
    default: {
      // Golden Lotus: shimmering warm gold sacred rosette
      drawScallopedRing(ctx, 12, r * 0.66, r * 0.35, '#F5B700', 'rgba(196, 130, 0, 0.3)');
      drawScallopedRing(ctx, 9, r * 0.48, r * 0.34, '#FFE66D', undefined, 0.2);

      const cGrad = ctx.createRadialGradient(-r * 0.18, -r * 0.18, r * 0.08, 0, 0, r * 0.6);
      cGrad.addColorStop(0, '#FFFDF0');
      cGrad.addColorStop(0.55, '#FFE66D');
      cGrad.addColorStop(1, '#F6BD16');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
      ctx.fill();

      // Tiny crown gleam
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.32, r * 0.07, 0, Math.PI * 2);
      ctx.fill();

      drawCuteFace(ctx, r * 0.8, '#FF8C61', '#4A3550', 'happy', r * 0.03);
      break;
    }
  }

  // Interactive selection ring for Bee / Sunshine targeting
  if (highlightRing) {
    ctx.strokeStyle = '#FFD93D';
    ctx.lineWidth = 4;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

export function drawPotAndBackdrop(
  ctx: CanvasRenderingContext2D,
  skin: PotSkinDef,
  dangerRatio: number,
  timeMs: number
) {
  const w = PLAYFIELD_WIDTH;
  const h = PLAYFIELD_HEIGHT;
  const wall = POT_WALL_THICKNESS;
  const topY = POT_TOP_Y;

  // Soft interior glow inside the pot playfield
  const innerLeft = wall;
  const innerWidth = w - wall * 2;
  const innerHeight = h - topY - wall;

  // Pot outer body shadow & silhouette
  ctx.save();
  ctx.fillStyle = skin.interiorBg;
  ctx.beginPath();
  ctx.roundRect(innerLeft, topY, innerWidth, innerHeight + 4, [6, 6, 28, 28]);
  ctx.fill();

  // Glass jar subtle reflection streaks
  if (skin.isGlass) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.roundRect(innerLeft + 14, topY + 20, 12, innerHeight - 50, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(innerLeft + 34, topY + 34, 5, innerHeight - 88, 3);
    ctx.fill();
  }

  // Danger line (dotted warning line)
  const isDanger = dangerRatio > 0;
  const blinkAlpha = isDanger ? 0.45 + Math.sin(timeMs * 0.015) * 0.35 : 0.38;
  ctx.strokeStyle = isDanger ? `rgba(225, 72, 92, ${blinkAlpha + 0.2})` : `rgba(74, 53, 80, ${blinkAlpha})`;
  ctx.lineWidth = isDanger ? 2.5 : 2;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(wall + 8, 116);
  ctx.lineTo(w - wall - 8, 116);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pot left, right, and bottom ceramic walls
  const wallGrad = ctx.createLinearGradient(0, topY, w, h);
  wallGrad.addColorStop(0, skin.potRimColor);
  wallGrad.addColorStop(0.5, skin.potColor);
  wallGrad.addColorStop(1, skin.potShadowColor);

  ctx.fillStyle = wallGrad;

  // Left wall
  ctx.beginPath();
  ctx.roundRect(0, topY, wall, h - topY, [8, 0, 0, 26]);
  ctx.fill();

  // Right wall
  ctx.beginPath();
  ctx.roundRect(w - wall, topY, wall, h - topY, [0, 8, 26, 0]);
  ctx.fill();

  // Bottom floor
  ctx.beginPath();
  ctx.roundRect(0, h - wall - 6, w, wall + 6, [0, 0, 26, 26]);
  ctx.fill();

  // Pot rim lip across left and right edges
  ctx.fillStyle = skin.potRimColor;
  ctx.beginPath();
  ctx.roundRect(-2, topY - 4, wall + 8, 18, 9);
  ctx.roundRect(w - wall - 6, topY - 4, wall + 8, 18, 9);
  ctx.fill();

  // Subtle decorative trim on golden / rooftop / terracotta pots
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(0, topY + 14, wall, 4);
  ctx.fillRect(w - wall, topY + 14, wall, 4);

  ctx.restore();
}

export function renderShareCardDataUrl(params: {
  score: number;
  bestStage: number;
  maxCombo: number;
  modeLabel: string;
  dateLabel: string;
}): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Pastel Garden Dream gradient
  const bg = ctx.createLinearGradient(0, 0, 0, 960);
  bg.addColorStop(0, '#FFF1E6');
  bg.addColorStop(1, '#DFF5EA');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 800, 960);

  // Inner botanical card frame
  ctx.fillStyle = 'rgba(255, 255, 255, 0.76)';
  ctx.strokeStyle = 'rgba(74, 53, 80, 0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(48, 48, 704, 864, 36);
  ctx.fill();
  ctx.stroke();

  // Header brand
  ctx.fillStyle = '#4A3550';
  ctx.textAlign = 'center';
  ctx.font = '800 44px "Bricolage Grotesque", sans-serif';
  ctx.fillText('Bloomies', 400, 128);

  ctx.fillStyle = '#7A6280';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${params.modeLabel} · ${params.dateLabel}`, 400, 168);

  // Soft pedestal circle behind hero flower
  const stageDef = FLOWER_STAGES[params.bestStage] || FLOWER_STAGES[0];
  const halo = ctx.createRadialGradient(400, 405, 40, 400, 405, 210);
  halo.addColorStop(0, 'rgba(255, 217, 61, 0.28)');
  halo.addColorStop(1, 'rgba(255, 217, 61, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(400, 405, 210, 0, Math.PI * 2);
  ctx.fill();

  drawFlower(ctx, params.bestStage, 400, 405, 138, 0, 1, 1, 1000, false);

  // Flower title
  ctx.fillStyle = '#4A3550';
  ctx.font = '700 40px "Bricolage Grotesque", sans-serif';
  ctx.fillText(stageDef.name, 400, 608);

  ctx.fillStyle = '#7A6280';
  ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Highest Bloom · ${stageDef.subtitle}`, 400, 646);

  // Divider
  ctx.strokeStyle = 'rgba(74, 53, 80, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 692);
  ctx.lineTo(680, 692);
  ctx.stroke();

  // Score & Max Combo
  ctx.fillStyle = '#7A6280';
  ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('GARDEN SCORE', 250, 748);
  ctx.fillText('BEST COMBO', 550, 748);

  ctx.fillStyle = '#4A3550';
  ctx.font = '700 54px "JetBrains Mono", monospace';
  ctx.fillText(params.score.toLocaleString(), 250, 812);
  ctx.fillText(`x${params.maxCombo}`, 550, 812);

  // Footer CTA
  ctx.fillStyle = '#7A6280';
  ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Drop, merge, and grow your Golden Lotus', 400, 878);

  return canvas.toDataURL('image/png');
}
