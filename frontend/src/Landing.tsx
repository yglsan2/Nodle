import { useState } from 'react';
import type { RoomRole } from './types';
import { useServerConfig, ServerConfigPanel } from './serverConfig';

type Props = {
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  role: RoomRole;
  onRoleChange: (r: RoomRole) => void;
  onJoin: (roomId: string) => void;
};

export function Landing({ displayName, onDisplayNameChange, role, onRoleChange, onJoin }: Props) {
  const { apiBase } = useServerConfig();
  const [meetingInput, setMeetingInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function startOrJoin() {
    const raw = meetingInput.trim();
    if (!raw) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: raw }),
      });
      if (!res.ok) throw new Error('Impossible d\'accéder à la réunion');
      const data = await res.json();
      onJoin(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  function joinById() {
    const id = meetingInput.trim();
    if (!id) return;
    setError('');
    onJoin(id);
  }

  const isLikelyId = /^[a-z0-9-]{8,}$/i.test(meetingInput.trim());

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <div style={styles.heroIcon} aria-hidden>✨</div>
        <h1 style={styles.title}>Nodle</h1>
        <p style={styles.subtitle}>
          Visio fluide, sans serveur. Cours, formations, réunions — un lien, c’est parti.
        </p>
      </div>

      <div style={styles.card} className="nodle-card">
        <label style={styles.label}>Votre nom</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Comment vous appeler ?"
          style={styles.input}
          autoComplete="name"
        />

        <label style={styles.label}>Vous êtes</label>
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as RoomRole)}
          style={styles.select}
          aria-label="Rôle dans la réunion"
        >
          <option value="participant">Participant</option>
          <option value="teacher">Enseignant</option>
          <option value="student">Élève</option>
        </select>

        <label style={styles.label}>Nom de la réunion</label>
        <input
          type="text"
          value={meetingInput}
          onChange={(e) => setMeetingInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && startOrJoin()}
          placeholder="ex. cours-maths-3e ou mon-id-unique"
          style={styles.input}
        />
        <div style={styles.buttonRow}>
          <button
            onClick={startOrJoin}
            disabled={loading || !meetingInput.trim()}
            style={{ ...styles.button, ...styles.primary }}
          >
            {loading ? 'Connexion…' : 'Démarrer ou rejoindre'}
          </button>
        </div>
        {isLikelyId && (
          <button type="button" onClick={joinById} style={styles.linkButton}>
            Rejoindre avec cet ID directement →
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          style={styles.toggleAdvanced}
        >
          {showAdvanced ? '− Moins' : '+ Réunion par ID ou lien'}
        </button>
        {showAdvanced && (
          <div style={styles.advanced}>
            <p style={styles.hint}>Collez l’ID de la salle (partagé par l’organisateur) pour rejoindre sans créer.</p>
            <input
              type="text"
              value={meetingInput}
              onChange={(e) => setMeetingInput(e.target.value)}
              placeholder="ID de la salle"
              style={styles.input}
            />
            <button onClick={joinById} style={styles.button}>Rejoindre cette salle</button>
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <ServerConfigPanel />
      </div>

      <p style={styles.footer}>
        Vidéo, audio, partage d’écran, chat, tableau blanc, fichiers. Relais ou serveur — vous choisissez.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: '2rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
    background: 'var(--bg)',
  },
  hero: {
    textAlign: 'center',
    maxWidth: 480,
    animation: 'nodle-slide-up 0.4s ease-out',
  },
  heroIcon: {
    fontSize: '3rem',
    marginBottom: '0.5rem',
    filter: 'drop-shadow(0 2px 8px var(--accent-soft))',
  },
  title: {
    fontSize: '2.25rem',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-strong)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    color: 'var(--text-muted)',
    margin: '0.75rem 0 0',
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  card: {
    padding: '2rem',
    width: '100%',
    maxWidth: 420,
    animation: 'nodle-slide-up 0.4s ease-out 0.05s both',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '1rem',
  },
  select: {
    width: '100%',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '1rem',
  },
  buttonRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' },
  button: {
    padding: '0.85rem 1.5rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    width: '100%',
  },
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    boxShadow: '0 4px 14px var(--accent-soft)',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '0.9rem',
    padding: '0.35rem 0',
    marginBottom: '0.5rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  toggleAdvanced: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    padding: '0.5rem 0',
    marginTop: '0.5rem',
    cursor: 'pointer',
  },
  advanced: { marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' },
  hint: { fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' },
  error: { color: 'var(--danger)', marginTop: '1rem', fontSize: '0.95rem' },
  footer: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 1.5,
    animation: 'nodle-fade-in 0.5s ease-out 0.2s both',
  },
};
