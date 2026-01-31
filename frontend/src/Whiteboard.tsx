import { useCallback, useEffect, useRef, useState } from 'react';
import type { WhiteboardStroke } from './types';

const COLORS = ['#000', '#c00', '#0a0', '#00a', '#a0a', '#fa0'];
const WIDTHS = [2, 4, 8];

type Props = {
  strokes: WhiteboardStroke[];
  onStroke: (stroke: WhiteboardStroke) => void;
  peerId: string;
};

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function Whiteboard({ strokes, onStroke, peerId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const drawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  const getCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCoords(e);
      drawingRef.current = true;
      currentPointsRef.current = [{ x, y }];
    },
    [getCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const { x, y } = getCoords(e);
      currentPointsRef.current.push({ x, y });
      redraw();
    },
    [getCoords]
  );

  const handleMouseUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const points = [...currentPointsRef.current];
    if (points.length < 2) return;
    const stroke: WhiteboardStroke = {
      id: genId(),
      fromPeerId: peerId,
      color,
      width,
      points,
    };
    onStroke(stroke);
    currentPointsRef.current = [];
  }, [peerId, color, width, onStroke]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => drawStroke(ctx, s));
    if (currentPointsRef.current.length >= 2) {
      drawStroke(ctx, {
        id: '',
        fromPeerId: '',
        color,
        width,
        points: currentPointsRef.current,
      });
    }
  }, [strokes, color, width]);

  const drawStroke = (ctx: CanvasRenderingContext2D, s: WhiteboardStroke) => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x, s.points[i].y);
    }
    ctx.stroke();
  };

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      redraw();
    }
  }, [redraw]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    redraw();
  }, [strokes, redraw]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(el);
    resize();
    return () => ro.disconnect();
  }, [resize]);

  return (
    <div style={styles.container} ref={containerRef}>
      <div style={styles.toolbar}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            style={{
              ...styles.colorBtn,
              background: c,
              border: color === c ? '2px solid #fff' : '1px solid var(--border)',
            }}
            title={c}
          />
        ))}
        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            style={{
              ...styles.widthBtn,
              ...(width === w ? styles.widthBtnActive : {}),
            }}
          >
            {w}px
          </button>
        ))}
        <span style={styles.hint}>Schémas et diagrammes partagés en direct.</span>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={styles.canvas}
      />
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
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
  },
  colorBtn: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    padding: 0,
    cursor: 'pointer',
  },
  widthBtn: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.85rem',
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
  },
  widthBtnActive: { background: 'var(--accent)', color: '#fff' },
  hint: { fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' },
  canvas: {
    flex: 1,
    width: '100%',
    minHeight: 200,
    background: '#fff',
    cursor: 'crosshair',
  },
};
