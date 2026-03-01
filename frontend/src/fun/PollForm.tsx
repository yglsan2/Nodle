import React, { useState } from 'react';

type Props = {
  onStart: (question: string, options: string[]) => void;
  onClose: () => void;
};

export function PollForm({ onStart, onClose }: Props) {
  const [question, setQuestion] = useState('');
  const [opts, setOpts] = useState(['Oui', 'Non']);

  const addOption = () => {
    if (opts.length >= 6) return;
    setOpts((p) => [...p, '']);
  };
  const setOption = (i: number, v: string) => {
    setOpts((p) => {
      const n = [...p];
      n[i] = v;
      return n;
    });
  };
  const removeOption = (i: number) => {
    if (opts.length <= 2) return;
    setOpts((p) => p.filter((_, j) => j !== i));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim() || 'Question ?';
    const list = opts.map((o) => o.trim() || 'Option').filter(Boolean);
    if (list.length < 2) return;
    onStart(q, list.length ? list : ['Oui', 'Non']);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>📊 Lancer un vote rapide</h3>
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>
            Question
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex. Vous avez compris ?"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>Réponses</label>
          {opts.map((o, i) => (
            <div key={i} style={styles.optionRow}>
              <input
                type="text"
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                style={styles.input}
              />
              <button type="button" onClick={() => removeOption(i)} style={styles.removeBtn} aria-label="Supprimer">
                ×
              </button>
            </div>
          ))}
          {opts.length < 6 && (
            <button type="button" onClick={addOption} style={styles.addBtn}>
              + Ajouter une option
            </button>
          )}
          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Annuler
            </button>
            <button type="submit" style={styles.submitBtn}>
              Lancer le vote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 901,
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
    maxWidth: 400,
    width: '90%',
  },
  title: { margin: '0 0 1rem', fontSize: '1.1rem' },
  label: { display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' },
  input: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    marginTop: '0.25rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  optionRow: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' },
  removeBtn: { width: 36, flexShrink: 0, background: 'var(--surface-hover)', color: 'var(--text-muted)' },
  addBtn: { marginBottom: '1rem', fontSize: '0.9rem', background: 'transparent', color: 'var(--accent)' },
  actions: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' },
  cancelBtn: { padding: '0.5rem 1rem', background: 'var(--surface-hover)' },
  submitBtn: { padding: '0.5rem 1rem', background: 'var(--accent)', color: '#fff' },
};
