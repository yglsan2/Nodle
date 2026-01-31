import { useEffect, useState } from 'react';

const API = '/api';

type Props = {
  roomId: string;
  onSelect: (url: string) => void;
  onClose: () => void;
};

type GifInfo = { url: string; category: string; filename: string };
type CategoryInfo = { name: string; count: number };

export function GifPicker({ onSelect, onClose }: Props) {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [gifs, setGifs] = useState<GifInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`${API}/gifs/categories`)
      .then((r) => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const url = selectedCategory
      ? `${API}/gifs/list?category=${encodeURIComponent(selectedCategory)}`
      : `${API}/gifs/list`;
    fetch(url)
      .then((r) => r.ok ? r.json() : [])
      .then(setGifs)
      .catch(() => setGifs([]));
  }, [selectedCategory]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', uploadFile);
    form.append('category', selectedCategory || 'custom');
    try {
      const res = await fetch(`${API}/gifs/upload`, { method: 'POST', body: form });
      if (res.ok) {
        const data = await res.json();
        setGifs((prev) => [{ url: data.url, category: data.category, filename: data.originalName }, ...prev]);
        setUploadFile(null);
      }
    } finally {
      setUploading(false);
    }
  };

  const fullUrl = (g: GifInfo) => (g.url.startsWith('http') ? g.url : `${location.origin}${g.url}`);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Choisir un GIF</h3>
          <button type="button" onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>
        <p style={styles.hint}>
          Tous formats acceptés : GIF, WebP animé, APNG, MP4, WebM (n'importe quel éditeur).
        </p>
        <div style={styles.categories}>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            style={{ ...styles.catBtn, ...(selectedCategory === null ? styles.catBtnActive : {}) }}
          >
            Tous
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setSelectedCategory(c.name)}
              style={{
                ...styles.catBtn,
                ...(selectedCategory === c.name ? styles.catBtnActive : {}),
              }}
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>
        <div style={styles.uploadRow}>
          <input
            type="file"
            accept=".gif,.webp,.png,.apng,.mp4,.webm"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
          />
          {uploadFile && (
            <button type="button" onClick={handleUpload} disabled={uploading} style={styles.uploadBtn}>
              {uploading ? 'Envoi…' : `Importer "${uploadFile.name}"`}
            </button>
          )}
        </div>
        <div style={styles.grid}>
          {gifs.map((g) => (
            <button
              key={g.url}
              type="button"
              onClick={() => onSelect(fullUrl(g))}
              style={styles.gifThumb}
            >
              {g.url.match(/\.(mp4|webm)$/i) ? (
                <video src={fullUrl(g)} muted loop playsInline autoPlay style={styles.thumbMedia} />
              ) : (
                <img src={fullUrl(g)} alt="" style={styles.thumbMedia} loading="lazy" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    maxWidth: 90 + '%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  title: { margin: 0, fontSize: '1rem' },
  closeBtn: { padding: '0.25rem 0.5rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius)' },
  hint: { fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' },
  categories: { display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' },
  catBtn: { padding: '0.25rem 0.5rem', fontSize: '0.85rem', borderRadius: 'var(--radius)' },
  catBtnActive: { background: 'var(--accent)', color: '#fff' },
  uploadRow: { marginBottom: '0.5rem' },
  uploadBtn: { marginLeft: '0.5rem', padding: '0.25rem 0.5rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '0.25rem',
    overflow: 'auto',
    flex: 1,
    minHeight: 200,
  },
  gifThumb: {
    padding: 0,
    border: 'none',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: 'var(--bg)',
    cursor: 'pointer',
  },
  thumbMedia: {
    width: '100%',
    height: 80,
    objectFit: 'cover',
    display: 'block',
  },
};
