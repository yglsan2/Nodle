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
  /** Appelé quand l'utilisateur met un fichier sur le tableau collaboratif */
  onAddToBoard?: (file: SharedFileInfo) => void;
};

const FILE_ICONS: Record<string, string> = {
  /* Documents */
  pdf: '📕',
  txt: '📄',
  md: '📝',
  rtf: '📄',
  doc: '📘',
  docx: '📘',
  odt: '📘',
  ott: '📘',
  xls: '📊',
  xlsx: '📊',
  ods: '📊',
  ots: '📊',
  csv: '📋',
  ppt: '📙',
  pptx: '📙',
  odp: '📙',
  otp: '📙',
  odg: '🎨',
  otg: '🎨',
  odc: '📈',
  odf: '📐',
  odb: '🗄️',
  odm: '📑',
  odi: '🖼️',
  oth: '📄',
  otf: '📄',
  /* Images & vectoriel */
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  gif: '🖼️',
  webp: '🖼️',
  svg: '🖼️',
  eps: '🖼️',
  ai: '✏️',
  psd: '🖼️',
  sketch: '✏️',
  xd: '✏️',
  /* Schémas & diagrammes */
  drawio: '📐',
  vsdx: '📐',
  vsd: '📐',
  excalidraw: '✏️',
  xml: '📋',
  /* MCD / Looping / modélisation */
  loo: '📊',
  mcd: '📊',
  merise: '📊',
  cdm: '📊',
  bpmn: '📐',
  xmi: '📐',
  uml: '📐',
  er: '📊',
  erd: '📊',
  /* CAO / 3D */
  blend: '🎲',
  obj: '🎲',
  stl: '🎲',
  '3ds': '🎲',
  dae: '🎲',
  step: '🎲',
  stp: '🎲',
  iges: '🎲',
  igs: '🎲',
  glb: '🎲',
  gltf: '🎲',
  dxf: '📐',
  dwg: '📐',
  /* Données & config */
  json: '📋',
  sql: '🗄️',
  yaml: '⚙️',
  yml: '⚙️',
  toml: '⚙️',
  /* Cartes mentales / plan */
  xmind: '🧠',
  mm: '🧠',
  opml: '📑',
  /* Publication */
  tex: '📄',
  epub: '📕',
  /* Archives */
  zip: '📦',
  tar: '📦',
  gz: '📦',
  /* Code */
  py: '🐍',
  js: '📜',
  ts: '📜',
  jsx: '📜',
  tsx: '📜',
  vue: '📜',
  html: '🌐',
  css: '🎨',
  scss: '🎨',
  java: '☕',
  c: '📜',
  cpp: '📜',
  h: '📜',
  rs: '🦀',
  go: '📜',
  php: '🐘',
  rb: '💎',
  sh: '📜',
  bat: '📜',
  kt: '📜',
  swift: '📜',
  /* Média */
  mp3: '🎵',
  mp4: '🎬',
  webm: '🎬',
  ogg: '🎵',
  wav: '🎵',
  m4a: '🎵',
  /* Polices */
  ttf: '🔤',
  otf: '🔤',
  woff: '🔤',
  woff2: '🔤',
};

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] ?? '📄';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

export function SharedFiles({ roomId, apiBase, displayName, onAddToBoard }: Props) {
  const [files, setFiles] = useState<SharedFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

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
    (file: File) => {
      if (!file) return;
      setUploading(true);
      setUploadProgress(0);
      const form = new FormData();
      form.append('file', file);
      form.append('uploaderName', displayName);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        setUploading(false);
        setUploadProgress(0);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data) setFiles((prev) => [data, ...prev]);
          } catch {}
        }
      });
      xhr.addEventListener('error', () => {
        setUploading(false);
        setUploadProgress(0);
      });
      xhr.open('POST', `${apiBase}/upload`);
      xhr.send(form);
    },
    [apiBase, displayName]
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = '';
    },
    [handleUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  const fileOrigin = apiBase.startsWith('http') ? new URL(apiBase).origin : location.origin;
  const fullUrl = (f: SharedFileInfo) =>
    f.url.startsWith('http') ? f.url : `${fileOrigin}${f.url}`;

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.dropZone,
          ...(dragOver ? styles.dropZoneActive : {}),
          ...(uploading ? styles.dropZoneDisabled : {}),
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file"
          id="shared-files-input"
          onChange={onFileInputChange}
          disabled={uploading}
          accept=".pdf,.txt,.md,.rtf,.doc,.docx,.odt,.ott,.xls,.xlsx,.ods,.ots,.csv,.ppt,.pptx,.odp,.otp,.odg,.otg,.odc,.odf,.odb,.odm,.odi,.oth,.otf,.png,.jpg,.jpeg,.gif,.webp,.svg,.eps,.ai,.psd,.sketch,.xd,.drawio,.vsdx,.vsd,.excalidraw,.xml,.loo,.mcd,.merise,.cdm,.bpmn,.xmi,.uml,.er,.erd,.blend,.obj,.stl,.3ds,.dae,.step,.stp,.iges,.igs,.glb,.gltf,.dxf,.dwg,.json,.sql,.yaml,.yml,.toml,.xmind,.mm,.opml,.tex,.epub,.zip,.tar,.gz,.py,.js,.ts,.jsx,.tsx,.vue,.html,.css,.scss,.java,.c,.cpp,.h,.rs,.go,.php,.rb,.sh,.bat,.kt,.swift,.mp3,.mp4,.webm,.ogg,.wav,.m4a,.ttf,.otf,.woff,.woff2"
          style={{ display: 'none' }}
        />
        <label htmlFor="shared-files-input" style={styles.dropZoneLabel}>
          {uploading ? (
            <>
              <span style={styles.dropZoneIcon}>⏳</span>
              <span>Envoi en cours… {uploadProgress}%</span>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressBar, width: `${uploadProgress}%` }} />
              </div>
            </>
          ) : (
            <>
              <span style={styles.dropZoneIcon}>📤</span>
              <span>Glissez un fichier ici ou cliquez pour parcourir</span>
            </>
          )}
        </label>
      </div>

      <p style={styles.hint}>
        LibreOffice, Office, PDF, MCD/Looping (.loo, .mcd), modélisation (BPMN, UML, drawio, vsdx), CAO/3D, code, médias, archives. Maximum de formats pour le travail collaboratif.
      </p>

      <div style={styles.grid}>
        {loading && <p style={styles.muted}>Chargement…</p>}
        {!loading && files.length === 0 && (
          <p style={styles.empty}>Aucun fichier. Déposez un document pour le partager.</p>
        )}
        {!loading && files.map((f) => (
          <div key={f.id} style={styles.fileCardWrap}>
            <a
              href={fullUrl(f)}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.fileCard}
              className="nodle-card"
            >
              <span style={styles.fileIcon}>{getFileIcon(f.name)}</span>
              <span style={styles.fileName} title={f.name}>{f.name}</span>
              <span style={styles.fileMeta}>
                {formatSize(f.size)}
                {f.uploaderName && ` · ${f.uploaderName}`}
              </span>
            </a>
            {onAddToBoard && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onAddToBoard(f);
                }}
                style={styles.addToBoardBtn}
                title="Mettre sur le tableau (manipulable, annotable, montrable aux autres)"
              >
                📋 Tableau
              </button>
            )}
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
  dropZone: {
    padding: '1.25rem',
    border: '2px dashed var(--border)',
    borderRadius: 'var(--radius)',
    textAlign: 'center',
    transition: 'border-color var(--transition-fast), background var(--transition-fast)',
    marginBottom: '0.75rem',
  },
  dropZoneActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-soft)',
  },
  dropZoneDisabled: {
    opacity: 0.9,
    cursor: 'not-allowed',
  },
  dropZoneLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
  },
  dropZoneIcon: {
    fontSize: '2rem',
  },
  progressTrack: {
    width: '100%',
    maxWidth: 200,
    height: 6,
    background: 'var(--border)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 3,
    transition: 'width 0.2s ease',
  },
  hint: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: '0 0 0.75rem',
  },
  grid: {
    flex: 1,
    overflow: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '0.75rem',
    alignContent: 'start',
  },
  fileCardWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  addToBoardBtn: {
    padding: '0.35rem 0.5rem',
    fontSize: '0.75rem',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 500,
  },
  fileCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '0.75rem',
    textDecoration: 'none',
    color: 'var(--text)',
    transition: 'transform var(--transition-fast), box-shadow var(--transition-normal)',
  },
  fileCardHover: {
    transform: 'translateY(-2px)',
    boxShadow: 'var(--shadow-md)',
  },
  fileIcon: {
    fontSize: '1.75rem',
    marginBottom: '0.35rem',
  },
  fileName: {
    fontSize: '0.9rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  fileMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '0.25rem',
  },
  muted: { color: 'var(--text-muted)', fontSize: '0.9rem', margin: '1rem 0', gridColumn: '1 / -1' },
  empty: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    margin: '1rem 0',
    gridColumn: '1 / -1',
    textAlign: 'center',
  },
};
