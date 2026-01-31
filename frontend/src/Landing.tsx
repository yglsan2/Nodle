import { useState } from 'react';

const API = '/api';

type Props = {
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  onJoin: (roomId: string) => void;
};

export function Landing({ displayName, onDisplayNameChange, onJoin }: Props) {
  const [roomName, setRoomName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createRoom() {
    if (!roomName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim() }),
      });
      if (!res.ok) throw new Error('Impossible de créer la salle');
      const data = await res.json();
      onJoin(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  function joinById() {
    const id = roomIdInput.trim();
    if (!id) return;
    setError('');
    onJoin(id);
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Nodle</h1>
        <p style={styles.subtitle}>
          Visioconférence pour établissements (écoles, AFPA) – cours en commun ou à distance (Nodle)
        </p>
      </header>

      <div style={styles.card}>
        <label style={styles.label}>Votre nom (affiché dans la salle)</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Ex. Marie Dupont"
          style={styles.input}
        />

        <hr style={styles.hr} />

        <h2 style={styles.h2}>Créer une salle (cours)</h2>
        <input
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Nom de la salle (ex. Maths 3e A)"
          style={styles.input}
        />
        <button
          onClick={createRoom}
          disabled={loading}
          style={{ ...styles.button, ...styles.primary }}
        >
          {loading ? 'Création…' : 'Créer la salle'}
        </button>

        <hr style={styles.hr} />

        <h2 style={styles.h2}>Rejoindre une salle</h2>
        <input
          type="text"
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
          placeholder="ID de la salle (ex. maths-3e-a-a1b2c3d4)"
          style={styles.input}
        />
        <button onClick={joinById} style={styles.button}>
          Rejoindre
        </button>

        {error && <p style={styles.error}>{error}</p>}
      </div>

      <p style={styles.footer}>
        Vidéo, audio, partage d’écran, chat et GIFs (tous formats). Fonctionne en P2P ou avec le
        relais de votre établissement.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  header: { textAlign: 'center' },
  title: { fontSize: '2rem', margin: 0, color: 'var(--text)' },
  subtitle: { color: 'var(--text-muted)', margin: '0.5rem 0 0' },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '2rem',
    width: '100%',
    maxWidth: 420,
    border: '1px solid var(--border)',
  },
  label: { display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '1rem',
  },
  button: {
    padding: '0.75rem 1.5rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    fontSize: '1rem',
    marginRight: '0.5rem',
    marginBottom: '0.5rem',
  },
  primary: { background: 'var(--accent)', color: '#fff' },
  hr: { border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' },
  h2: { fontSize: '1.1rem', margin: '0 0 0.75rem' },
  error: { color: 'var(--danger)', marginTop: '1rem' },
  footer: { color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', maxWidth: 480 },
};
