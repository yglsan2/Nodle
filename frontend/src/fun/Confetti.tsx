/**
 * Confettis légers (CSS) – déclenchés par une réaction 🎉 ou une fin de vote.
 * Animation courte, désactivée si reduced-motion.
 */
import { useEffect, useState } from 'react';

const COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'];
const COUNT = 35;

type Piece = { id: number; x: number; delay: number; duration: number; color: string; size: number; rotation: number };

export function Confetti({ active, onDone }: { active: boolean; onDone?: () => void }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }
    const list: Piece[] = [];
    for (let i = 0; i < COUNT; i++) {
      list.push({
        id: i,
        x: Math.random() * 100 - 10,
        delay: Math.random() * 0.3,
        duration: 2 + Math.random() * 1.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      });
    }
    setPieces(list);
    const t = setTimeout(() => {
      onDone?.();
    }, 4000);
    return () => clearTimeout(t);
  }, [active, onDone]);

  if (pieces.length === 0) return null;

  return (
    <div
      className="nodle-confetti"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 999,
        overflow: 'hidden',
      }}
      aria-hidden
    >
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: -20,
            width: p.size,
            height: p.size,
            marginLeft: `${p.x}vw`,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : 2,
            transform: `rotate(${p.rotation}deg)`,
            animation: `nodle-confetti-fall ${p.duration}s ease-out ${p.delay}s forwards`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}
