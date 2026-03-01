/**
 * Vote rapide / quizz flash – le prof pose une question, tout le monde vote en 1 clic.
 * Unique à Nodle : résultats en direct, sans quitter la visio.
 */
import React from 'react';

export type PollData = {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>; // peerId -> optionIndex
};

type Props = {
  poll: PollData;
  myPeerId: string;
  onVote: (optionIndex: number) => void;
  onClose: () => void;
  canClose: boolean;
};

export const QuickPoll = React.memo(function QuickPoll({ poll, myPeerId, onVote, onClose, canClose }: Props) {
  const myVote = poll.votes[myPeerId] ?? null;
  const total = Object.keys(poll.votes).length;
  const counts = poll.options.map((_, i) => Object.values(poll.votes).filter((v) => v === i).length);
  const maxCount = Math.max(...counts, 1);

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.badge}>📊 Vote rapide</span>
          {canClose && (
            <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Fermer">
              ×
            </button>
          )}
        </div>
        <p style={styles.question}>{poll.question}</p>
        <div style={styles.options}>
          {poll.options.map((label, i) => {
            const count = counts[i];
            const pct = total ? (count / total) * 100 : 0;
            const isMyVote = myVote === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => myVote === null && onVote(i)}
                style={{
                  ...styles.optionBtn,
                  ...(isMyVote ? styles.optionBtnVoted : {}),
                }}
                disabled={myVote !== null}
              >
                <div style={styles.optionHead}>
                  <span style={styles.optionLabel}>{label}</span>
                  <span style={styles.optionPct}>{total ? Math.round(pct) : 0}%</span>
                </div>
                <span style={styles.optionBarWrap}>
                  <span style={{ ...styles.optionBar, width: `${pct}%` }} />
                </span>
                <span style={styles.optionCount}>{count} vote{count !== 1 ? 's' : ''}</span>
              </button>
            );
          })}
        </div>
        <p style={styles.footer}>{total} participant{total !== 1 ? 's' : ''} ont voté</p>
      </div>
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 900,
    animation: 'nodle-fade-in 0.2s ease-out',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '1.25rem 1.5rem',
    maxWidth: 420,
    width: '90%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  badge: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    fontSize: '1.25rem',
    lineHeight: 1,
    background: 'transparent',
    color: 'var(--text-muted)',
  },
  question: {
    margin: '0 0 1rem',
    fontSize: '1.1rem',
    fontWeight: 600,
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  optionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.25rem',
    padding: '0.6rem 0.75rem',
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
    textAlign: 'left',
    width: '100%',
    border: '2px solid transparent',
  },
  optionBtnVoted: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-soft)',
  },
  optionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  optionLabel: {
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  optionPct: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--accent)',
  },
  optionBarWrap: {
    width: '100%',
    height: 6,
    background: 'var(--border)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  optionBar: {
    display: 'block',
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  optionCount: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  footer: {
    margin: '0.75rem 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
};
