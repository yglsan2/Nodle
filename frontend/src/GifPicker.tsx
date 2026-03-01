import { useCallback, useEffect, useRef, useState } from 'react';
import { useServerConfig } from './serverConfig';
const SEARCH_DEBOUNCE_MS = 350;

type Props = {
  roomId: string;
  onSelect: (url: string) => void;
  onClose: () => void;
};

type GifInfo = { url: string; category: string; filename: string };
type CategoryInfo = { name: string; count: number };
type SearchResult = { url: string; title: string; provider: string; id: string };

export function GifPicker({ onSelect, onClose }: Props) {
  const { apiBase } = useServerConfig();
  const [providers, setProviders] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [gifs, setGifs] = useState<GifInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/gifs/providers`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [apiBase]);

  useEffect(() => {
    fetch(`${apiBase}/gifs/categories`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [apiBase]);

  useEffect(() => {
    const url = selectedCategory
      ? `${apiBase}/gifs/list?category=${encodeURIComponent(selectedCategory)}`
      : `${apiBase}/gifs/list`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then(setGifs)
      .catch(() => setGifs([]));
  }, [selectedCategory, apiBase]);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    fetch(`${apiBase}/gifs/search?q=${encodeURIComponent(q.trim())}&limit=24`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SearchResult[]) => {
        setSearchResults(Array.isArray(data) ? data : []);
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchTimeoutRef.current = null;
      runSearch(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, runSearch]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', uploadFile);
    form.append('category', selectedCategory || 'custom');
    try {
      const res = await fetch(`${apiBase}/gifs/upload`, { method: 'POST', body: form });
      if (res.ok) {
        const data = await res.json();
        setGifs((prev) => [{ url: data.url, category: data.category, filename: data.originalName }, ...prev]);
        setUploadFile(null);
      }
    } finally {
      setUploading(false);
    }
  };

  const fileOrigin = apiBase.startsWith('http') ? new URL(apiBase).origin : location.origin;
  const fullUrl = (g: GifInfo) => (g.url.startsWith('http') ? g.url : `${fileOrigin}${g.url}`);
  const showSearchResults = searchQuery.trim().length > 0;

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
          Recherche sur {providers.length ? providers.join(', ') : 'aucun fournisseur'} (configurez les clés API). Import local : tous formats (GIF, WebP, APNG, MP4, WebM).
        </p>

        <div style={styles.searchRow}>
          <input
            type="search"
            placeholder="Rechercher un GIF…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searching && <span style={styles.searching}>Recherche…</span>}
        </div>

        {showSearchResults ? (
          <div style={styles.grid} role="listbox">
            {searchResults.length === 0 && !searching && (
              <p style={styles.muted}>Aucun résultat. Vérifiez les clés API (Giphy, Tenor) dans la config.</p>
            )}
            {searchResults.map((g) => (
              <button
                key={`${g.provider}-${g.id}`}
                type="button"
                onClick={() => onSelect(g.url)}
                style={styles.gifThumb}
                title={g.title || g.provider}
              >
                <img src={g.url} alt="" style={styles.thumbMedia} loading="lazy" />
                <span style={styles.providerBadge}>{g.provider}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
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
          </>
        )}
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
    maxWidth: '90%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  title: { margin: 0, fontSize: '1rem' },
  closeBtn: { padding: '0.25rem 0.5rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius)' },
  hint: { fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' },
  searchRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  searchInput: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.9rem',
  },
  searching: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  providerBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    fontSize: '0.65rem',
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    padding: '0.1rem 0.3rem',
    borderRadius: 2,
  },
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
    position: 'relative',
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
  muted: { color: 'var(--text-muted)', fontSize: '0.85rem', gridColumn: '1 / -1', margin: '1rem 0' },
};
