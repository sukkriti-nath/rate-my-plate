"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  scale: number;
  speedX: number;
  speedY: number;
  emoji: string;
}

const EMOJIS = ["🎉", "🍽️", "⭐", "🔥", "👨‍🍳", "🥗", "🍲", "💚"];
const COLORS = ["#b5fc4f", "#94cf40", "#FFD700", "#FF6B6B", "#4ECDC4", "#fff"];

export default function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;

    const newParticles: Particle[] = [];
    for (let i = 0; i < 40; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        rotation: Math.random() * 360,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        scale: 0.5 + Math.random() * 1,
        speedX: (Math.random() - 0.5) * 3,
        speedY: 2 + Math.random() * 4,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      });
    }
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 3000);
    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            fontSize: `${p.scale * 24}px`,
            animationDuration: `${1.5 + Math.random() * 1.5}s`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}
