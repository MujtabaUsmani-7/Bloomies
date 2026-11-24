import { useEffect, useRef } from 'react';
import { drawFlower } from '../game/renderer';

interface FlowerThumbnailProps {
  stage: number;
  size?: number;
  className?: string;
  locked?: boolean;
}

export function FlowerThumbnail({ stage, size = 48, className = '', locked = false }: FlowerThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    if (locked) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.filter = 'grayscale(100%)';
      drawFlower(ctx, stage, size / 2, size / 2, size * 0.38, 0, 1, 1, 0, false);
      ctx.restore();
    } else {
      drawFlower(ctx, stage, size / 2, size / 2, size * 0.39, 0, 1, 1, 1200, false);
    }
  }, [stage, size, locked]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={`block shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}
