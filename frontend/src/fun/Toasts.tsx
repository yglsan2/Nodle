/**
 * Toasts légers : bienvenue à l’arrivée d’un participant, réaction flottante.
 */
import React, { useEffect, useState } from 'react';

const TOAST_DURATION_MS = 3200;

export function WelcomeToast({ name, onDone }: { name: string; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;
  return (
    <div style={styles.welcomeWrap} role="status" aria-live="polite">
      <div style={styles.welcomeCard}>
        <span style={styles.welcomeEmoji}>👋</span>
        <span style={styles.welcomeText}>Bienvenue, <strong>{name}</strong> !</span>
      </div>
    </div>
  );
}

export function ReactionToast({ emoji, displayName, onDone }: { emoji: string; displayName: string; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400);
    }, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;
  return (
    <div style={styles.reactionWrap} role="status">
      <div style={styles.reactionCard} className="nodle-animate">
        <span style={styles.reactionEmoji}>{emoji}</span>
        <span style={styles.reactionName}>{displayName}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  welcomeWrap: {
    position: 'fixed',
    top: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 800,
    animation: 'nodle-fade-in 0.3s ease-out',
  },
  welcomeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.25rem',
    background: 'var(--surface)',
    borderRadius: 999,
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    border: '1px solid var(--border)',
  },
  welcomeEmoji: { fontSize: '1.5rem' },
  welcomeText: { fontSize: '0.95rem', color: 'var(--text)' },
  reactionWrap: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 801,
    animation: 'nodle-fade-in 0.15s ease-out',
  },
  reactionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '1rem 1.5rem',
    background: 'rgba(0,0,0,0.6)',
    borderRadius: 'var(--radius)',
    animation: 'nodle-reaction-pop 0.5s ease-out',
  },
  reactionEmoji: { fontSize: '3rem', lineHeight: 1 },
  reactionName: { fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' },
};
