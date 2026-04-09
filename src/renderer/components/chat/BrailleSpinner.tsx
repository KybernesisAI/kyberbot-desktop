/**
 * Braille columns spinner — animated unicode braille characters for thinking/waiting states.
 * Adapted from gunnargray-dev/unicode-animations (columns pattern).
 */

import { useState, useEffect } from 'react';

// Pre-computed braille frames for the "columns" animation
// Each frame is a string of 3 braille characters (6 dots wide, 4 dots tall)
const FRAMES = (() => {
  const DOT_MAP = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];
  const W = 6, H = 4;

  const grid = (rows: number, cols: number) =>
    Array.from({ length: rows }, () => Array(cols).fill(false));

  const toBraille = (g: boolean[][]) => {
    let result = '';
    for (let c = 0; c < Math.ceil(g[0].length / 2); c++) {
      let code = 0x2800;
      for (let r = 0; r < 4 && r < g.length; r++) {
        for (let d = 0; d < 2; d++) {
          const col = c * 2 + d;
          if (col < g[0].length && g[r]?.[col]) code |= DOT_MAP[r][d];
        }
      }
      result += String.fromCodePoint(code);
    }
    return result;
  };

  const frames: string[] = [];
  for (let col = 0; col < W; col++) {
    for (let fillTo = H - 1; fillTo >= 0; fillTo--) {
      const g = grid(H, W);
      for (let pc = 0; pc < col; pc++) {
        for (let r = 0; r < H; r++) g[r][pc] = true;
      }
      for (let r = fillTo; r < H; r++) g[r][col] = true;
      frames.push(toBraille(g));
    }
  }
  const full = grid(H, W);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) full[r][c] = true;
  frames.push(toBraille(full));
  frames.push(toBraille(grid(H, W)));
  return frames;
})();

interface BrailleSpinnerProps {
  color?: string;
  className?: string;
}

export default function BrailleSpinner({ color = 'var(--accent-emerald)', className }: BrailleSpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % FRAMES.length);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={className}
      style={{
        color,
        fontFamily: 'var(--font-mono)',
        fontSize: '14px',
        letterSpacing: '1px',
        lineHeight: 1,
      }}
    >
      {FRAMES[frame]}
    </span>
  );
}
