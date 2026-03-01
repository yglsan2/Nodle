/**
 * Tableau collaboratif de documents : déplacer, redimensionner, pivoter,
 * montrer/masquer, annoter. Synchronisé en temps réel via la salle.
 */
import { useCallback, useRef, useState } from 'react';
import type { PlacedDoc } from './types';

const MIN_W = 120;
const MIN_H = 80;
const RESIZE_HANDLE = 10;

type Props = {
  placedDocs: PlacedDoc[];
  fileBaseUrl: string;
  myPeerId: string;
  onUpdate: (id: string, patch: Partial<Pick<PlacedDoc, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'annotation'>>) => void;
  onRemove: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
};

function isImageType(ct: string, name: string): boolean {
  const ctLower = ct?.toLowerCase() ?? '';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return /^image\//.test(ctLower) || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
}

export function DocBoard({
  placedDocs,
  fileBaseUrl,
  myPeerId,
  onUpdate,
  onRemove,
  onToggleVisibility,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ id: string; startX: number; startY: number; docX: number; docY: number } | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    id: string;
    corner: 'se' | 'sw' | 'ne' | 'nw';
    startX: number;
    startY: number;
    w: number;
    h: number;
    docX: number;
    docY: number;
  } | null>(null);
  const [rotateStart, setRotateStart] = useState<{
    id: string;
    startAngle: number;
    startRotation: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);

  const fullUrl = useCallback(
    (doc: PlacedDoc) => (doc.url.startsWith('http') ? doc.url : `${fileBaseUrl.replace(/\/?$/, '')}${doc.url.startsWith('/') ? '' : '/'}${doc.url}`),
    [fileBaseUrl]
  );

  const handleBoardMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragStart) {
        const dx = e.clientX - dragStart.startX;
        const dy = e.clientY - dragStart.startY;
        onUpdate(dragStart.id, { x: dragStart.docX + dx, y: dragStart.docY + dy });
      } else if (resizeStart) {
        const dx = e.clientX - resizeStart.startX;
        const dy = e.clientY - resizeStart.startY;
        let w = resizeStart.w;
        let h = resizeStart.h;
        let newX = resizeStart.docX;
        let newY = resizeStart.docY;
        if (resizeStart.corner.includes('e')) w += dx;
        else w -= dx;
        if (resizeStart.corner.includes('s')) h += dy;
        else h -= dy;
        w = Math.max(MIN_W, Math.round(w));
        h = Math.max(MIN_H, Math.round(h));
        if (resizeStart.corner.includes('w')) newX = resizeStart.docX + resizeStart.w - w;
        if (resizeStart.corner.includes('n')) newY = resizeStart.docY + resizeStart.h - h;
        onUpdate(resizeStart.id, { width: w, height: h, x: newX, y: newY });
      } else if (rotateStart) {
        const doc = placedDocs.find((d) => d.id === rotateStart.id);
        if (!doc) return;
        const cx = doc.x + doc.width / 2;
        const cy = doc.y + doc.height / 2;
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        const delta = (angle - rotateStart.startAngle) * (180 / Math.PI);
        onUpdate(rotateStart.id, { rotation: rotateStart.startRotation + delta });
      }
    },
    [dragStart, resizeStart, rotateStart, placedDocs, onUpdate]
  );

  const handleBoardMouseUp = useCallback(() => {
    setDragStart(null);
    setResizeStart(null);
    setRotateStart(null);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <span style={styles.hint}>
          Glissez les documents pour les déplacer. Poignées pour redimensionner et pivoter. Œil = visible pour tous, masquer sinon.
        </span>
      </div>
      <div
        ref={boardRef}
        style={{
          ...styles.board,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={handleBoardMouseUp}
        onMouseLeave={handleBoardMouseUp}
      >
        {placedDocs.map((doc) => (
          <DocCard
            key={doc.id}
            doc={doc}
            fullUrl={fullUrl(doc)}
            myPeerId={myPeerId}
            isEditingAnnotation={editingAnnotation === doc.id}
            onStartEditAnnotation={() => setEditingAnnotation(doc.id)}
            onBlurAnnotation={() => setEditingAnnotation(null)}
            onAnnotationChange={(text) => onUpdate(doc.id, { annotation: text })}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onToggleVisibility={onToggleVisibility}
            onDragStart={(e) => {
              e.preventDefault();
              setDragStart({
                id: doc.id,
                startX: e.clientX,
                startY: e.clientY,
                docX: doc.x,
                docY: doc.y,
              });
            }}
            onResizeStart={(corner, e) => {
              e.stopPropagation();
              setResizeStart({
                id: doc.id,
                corner,
                startX: e.clientX,
                startY: e.clientY,
                w: doc.width,
                h: doc.height,
                docX: doc.x,
                docY: doc.y,
              });
            }}
            onRotateStart={(e) => {
              e.stopPropagation();
              const rect = (e.target as HTMLElement).closest('[data-doc-card]')?.getBoundingClientRect();
              if (!rect) return;
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
              setRotateStart({
                id: doc.id,
                startAngle,
                startRotation: doc.rotation,
                centerX,
                centerY,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DocCard({
  doc,
  fullUrl,
  myPeerId,
  isEditingAnnotation,
  onStartEditAnnotation,
  onBlurAnnotation,
  onAnnotationChange,
  onUpdate,
  onRemove,
  onToggleVisibility,
  onDragStart,
  onResizeStart,
  onRotateStart,
}: {
  doc: PlacedDoc;
  fullUrl: string;
  myPeerId: string;
  isEditingAnnotation: boolean;
  onStartEditAnnotation: () => void;
  onBlurAnnotation: () => void;
  onAnnotationChange: (text: string) => void;
  onUpdate: (id: string, patch: Partial<PlacedDoc>) => void;
  onRemove: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (corner: 'se' | 'sw' | 'ne' | 'nw', e: React.MouseEvent) => void;
  onRotateStart: (e: React.MouseEvent) => void;
}) {
  const isImage = isImageType(doc.contentType, doc.name);

  return (
    <div
      data-doc-card
      style={{
        ...styles.card,
        left: doc.x,
        top: doc.y,
        width: doc.width,
        height: doc.height,
        transform: `rotate(${doc.rotation}deg)`,
        opacity: doc.visible ? 1 : 0.5,
        border: doc.visible ? '2px solid var(--accent)' : '2px dashed var(--border)',
      }}
    >
      <div style={styles.cardHeader} onMouseDown={onDragStart}>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.cardTitle}
          onClick={(e) => e.stopPropagation()}
        >
          {doc.name}
        </a>
        <div style={styles.cardActions}>
          <button
            type="button"
            onClick={() => onToggleVisibility(doc.id, !doc.visible)}
            style={styles.iconBtn}
            title={doc.visible ? 'Masquer pour les autres' : 'Montrer à tous'}
          >
            {doc.visible ? '👁️' : '👁️‍🗨️'}
          </button>
          <button type="button" onClick={() => onRemove(doc.id)} style={styles.iconBtn} title="Retirer du tableau">
            ✕
          </button>
        </div>
      </div>
      <div style={styles.previewWrap}>
        {isImage ? (
          <img src={fullUrl} alt={doc.name} style={styles.previewImg} />
        ) : (
          <div style={styles.previewPlaceholder}>
            <a href={fullUrl} target="_blank" rel="noopener noreferrer" style={styles.previewLink}>
              Ouvrir le document
            </a>
          </div>
        )}
      </div>
      <div style={styles.annotationWrap}>
        {isEditingAnnotation ? (
          <textarea
            value={doc.annotation ?? ''}
            onChange={(e) => onAnnotationChange(e.target.value)}
            onBlur={onBlurAnnotation}
            placeholder="Annoter…"
            style={styles.annotationInput}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={onStartEditAnnotation}
            style={styles.annotationBtn}
            title="Ajouter ou modifier une annotation"
          >
            {doc.annotation ? `📝 ${doc.annotation.slice(0, 30)}${doc.annotation.length > 30 ? '…' : ''}` : '📝 Annoter'}
          </button>
        )}
      </div>
      <button
        type="button"
        style={styles.rotateHandle}
        onMouseDown={onRotateStart}
        title="Pivoter"
      >
        🔄
      </button>
      {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
        <div
          key={corner}
          style={{
            ...styles.resizeHandle,
            [corner.includes('n') ? 'top' : 'bottom']: -RESIZE_HANDLE / 2,
            [corner.includes('e') ? 'right' : 'left']: -RESIZE_HANDLE / 2,
          }}
          onMouseDown={(e) => onResizeStart(corner, e)}
        />
      ))}
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
  toolbar: {
    padding: '0.5rem',
    borderBottom: '1px solid var(--border)',
  },
  hint: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  board: {
    flex: 1,
    minHeight: 400,
    position: 'relative',
    background: 'repeating-linear-gradient(90deg, var(--surface) 0, var(--surface) 20px, var(--border) 20px, var(--border) 21px), repeating-linear-gradient(0deg, var(--surface) 0, var(--surface) 20px, var(--border) 20px, var(--border) 21px)',
    backgroundSize: '100% 100%',
  },
  card: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'visible',
    cursor: 'grab',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.25rem 0.5rem',
    background: 'var(--surface-hover)',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text)',
    textDecoration: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '70%',
  },
  cardActions: {
    display: 'flex',
    gap: '0.25rem',
  },
  iconBtn: {
    padding: '0.2rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    borderRadius: 'var(--radius)',
  },
  previewWrap: {
    flex: 1,
    minHeight: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    overflow: 'hidden',
  },
  previewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  previewPlaceholder: {
    padding: '0.5rem',
    textAlign: 'center',
  },
  previewLink: {
    fontSize: '0.8rem',
    color: 'var(--accent)',
  },
  annotationWrap: {
    flexShrink: 0,
    padding: '0.25rem 0.5rem',
    borderTop: '1px solid var(--border)',
  },
  annotationBtn: {
    width: '100%',
    padding: '0.25rem',
    fontSize: '0.75rem',
    background: 'transparent',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    textAlign: 'left',
  },
  annotationInput: {
    width: '100%',
    minHeight: 40,
    padding: '0.25rem',
    fontSize: '0.75rem',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    resize: 'vertical',
    background: 'var(--surface)',
    color: 'var(--text)',
  },
  rotateHandle: {
    position: 'absolute',
    top: -28,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 24,
    height: 24,
    padding: 0,
    border: 'none',
    borderRadius: '50%',
    background: 'var(--accent)',
    cursor: 'grab',
    fontSize: '0.7rem',
  },
  resizeHandle: {
    position: 'absolute',
    width: RESIZE_HANDLE,
    height: RESIZE_HANDLE,
    background: 'var(--accent)',
    borderRadius: 2,
    cursor: 'nwse-resize',
  },
};
