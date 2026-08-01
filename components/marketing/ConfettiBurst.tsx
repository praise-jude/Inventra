"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#14b8a6", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#22c55e"];

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
  delay: number;
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 70 + Math.random() * 50;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 30,
      rotate: Math.random() * 360,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.08,
    };
  });
}

// Purely decorative — no factual claims, so no discipline conflict here.
// Hand-rolled with framer-motion (already a dependency) instead of pulling
// in canvas-confetti for a one-off effect.
export function ConfettiBurst({ active }: { active: boolean }) {
  // Deliberately re-randomizing particle trajectories on every activation,
  // not reading `active` inside the callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const particles = useMemo(() => makeParticles(24), [active]);

  return (
    <AnimatePresence>
      {active && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden="true">
          {particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.6, rotate: p.rotate }}
              transition={{ duration: 0.9, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-2 w-2 rounded-sm"
              style={{ background: p.color }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
