import { useCallback, useEffect, useState } from 'react';

type SharedFileInfo = {
  id: string;
  name: string;
  url: string;
  contentType: string;
  size: number;
  uploaderName: string;
  uploadedAt: number;
};

type Props = {
  roomId: string;
  apiBase: string;
  displayName: string;
};

export function SharedFiles({ roomId, apiBase, displayName }: Props) {
  const [files, setFiles] = useState<SharedFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${apiBase}/list`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [apiBase]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setUploading(true);
      const form = new FormData();
      form.append('file', file);
      form.append('uploaderName', displayName);
      fetch(`${apiBase}/upload`, { method: 'POST', body: form })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setFiles((prev) => [data, ...prev]);
        })
        .finally(() => setUploading(false));
    },
    [apiBase, displayName]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  };

  const fullUrl = (f: SharedFileInfo) =>
    f.url.startsWith('http') ? f.url : `${location.origin}${f.url}`;

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <label style={styles.uploadLabel}>
          <input
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.md,.doc,.docx,.xls,.xlsx,.json,.csv,.drawio,.odt,.ods"
          />
          {uploading ? 'Envoi…' : '📤 Déposer un fichier'}
        </label>
      </div>
      <p style={styles.hint}>
        Documents, schémas, diagrammes, PDF, texte : partagés avec toute la salle.
      </p>
      <div style={styles.list}>
        {loading && <p style={styles.muted}>Chargement…</p>}
        {!loading && files.length === 0 && (
          <p style={styles.muted}>Aucun fichier. Déposez un document pour le partager.</p>
        )}
        {files.map((f) => (
          <div key={f.id} style={styles.fileRow}>
            <a
              href={fullUrl(f)}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.fileLink}
            >
              📄 {f.name}
            </a>
            <span style={styles.fileMeta}>
              {formatSize(f.size)}
              {f.uploaderName && ` · ${f.uploaderName}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  toolbar: { padding: '0.5rem', borderBottom: '1px solid var(--border)' },
  uploadLabel: {
    display: 'inline-block',
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  hint: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    padding: '0.5rem',
    margin: 0,
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '0.5rem',
  },
  fileRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem',
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
    marginBottom: '0.25rem',
  },
  fileLink: {
    color: 'var(--accent)',
    fontSize: '0.9rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileMeta: { fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.5rem' },
  muted: { color: 'var(--text-muted)', fontSize: '0.9rem', margin: '1rem 0' },
};
