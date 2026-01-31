import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSignaling } from './useSignaling';
import { useWebRTC } from './useWebRTC';
import type { SignalingMessage } from './useSignaling';
import type { ChatMessage } from './types';
import type { WhiteboardStroke } from './types';
import { Chat } from './Chat';
import { Whiteboard } from './Whiteboard';
import { SharedFiles } from './SharedFiles';

type Tab = 'chat' | 'whiteboard' | 'files';

type Props = {
  roomId: string;
  displayName: string;
  onLeave: () => void;
};

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function Room({ roomId, displayName, onLeave }: Props) {
  const peerId = useMemo(() => 'peer-' + genId(), []);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<WhiteboardStroke[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  const dispatchRef = useRef<(msg: SignalingMessage) => void>(() => {});

  const { connected, send: signalingSend } = useSignaling({
    roomId,
    peerId,
    onMessage: (msg) => dispatchRef.current(msg),
  });

  const webRTC = useWebRTC({
    roomId,
    localPeerId: peerId,
    displayName,
    signalingSend,
  });

  const handleSignalMessage = useCallback((msg: SignalingMessage) => {
    if (msg.type === 'chat' && msg.payload) {
      const p = msg.payload as Record<string, unknown>;
      setChatMessages((prev) => [
        ...prev,
        {
          id: (p.id as string) || genId(),
          fromPeerId: (msg.fromPeerId as string) || '',
          displayName: (p.displayName as string) || 'Anonyme',
          at: (p.at as number) || Date.now(),
          text: p.text as string | undefined,
          gifUrl: p.gifUrl as string | undefined,
          attachment: p.attachment as ChatMessage['attachment'],
          codeBlock: p.codeBlock as ChatMessage['codeBlock'],
        },
      ]);
      return;
    }
    if (msg.type === 'whiteboard' && msg.payload) {
      const p = msg.payload as { stroke?: WhiteboardStroke };
      if (p.stroke) {
        setWhiteboardStrokes((prev) => [...prev, p.stroke]);
      }
    }
  }, []);

  useEffect(() => {
    dispatchRef.current = (msg: SignalingMessage) => {
      handleSignalMessage(msg);
      webRTC.handleSignalingMessage(msg);
    };
  }, [handleSignalMessage, webRTC.handleSignalingMessage]);

  const sendChatMessage = useCallback(
    (payload: Omit<ChatMessage, 'id' | 'fromPeerId' | 'at'>) => {
      const msg: ChatMessage = {
        ...payload,
        id: genId(),
        fromPeerId: peerId,
        at: Date.now(),
      };
      setChatMessages((prev) => [...prev, msg]);
      signalingSend({
        type: 'chat',
        payload: {
          id: msg.id,
          fromPeerId: peerId,
          displayName: msg.displayName,
          at: msg.at,
          text: msg.text,
          gifUrl: msg.gifUrl,
          attachment: msg.attachment,
          codeBlock: msg.codeBlock,
        },
      });
    },
    [peerId, signalingSend]
  );

  const sendWhiteboardStroke = useCallback(
    (stroke: WhiteboardStroke) => {
      setWhiteboardStrokes((prev) => [...prev, stroke]);
      signalingSend({ type: 'whiteboard', payload: { stroke } });
    },
    [signalingSend]
  );

  const leave = useCallback(() => {
    webRTC.leave();
    onLeave();
  }, [webRTC, onLeave]);

  const apiBase = useMemo(() => `/api/rooms/${roomId}/files`, [roomId]);

  return (
    <div style={styles.layout}>
      <header style={styles.header}>
        <h1 style={styles.title}>Nodle · {roomId}</h1>
        <span style={styles.badge}>{connected ? 'Connecté' : 'Connexion…'}</span>
        <button type="button" onClick={leave} style={styles.leaveBtn}>
          Quitter
        </button>
      </header>

      <div style={styles.main}>
        <section style={styles.videoSection}>
          <div style={styles.videoGrid}>
            <LocalVideo
              stream={webRTC.localStream}
              screenStream={webRTC.screenStream}
              displayName={webRTC.displayName}
              videoEnabled={webRTC.videoEnabled}
            />
            {webRTC.remotePeers.map((p) => (
              <RemoteVideo
                key={p.peerId}
                peerId={p.peerId}
                stream={p.stream}
                screenStream={p.screenStream}
              />
            ))}
          </div>
          <div style={styles.controls}>
            <button
              type="button"
              onClick={webRTC.toggleVideo}
              style={{
                ...styles.controlBtn,
                ...(webRTC.videoEnabled ? {} : styles.controlBtnOff),
              }}
              title={webRTC.videoEnabled ? 'Couper la caméra' : 'Activer la caméra'}
            >
              {webRTC.videoEnabled ? '📹' : '📵'}
            </button>
            <button
              type="button"
              onClick={webRTC.toggleAudio}
              style={{
                ...styles.controlBtn,
                ...(webRTC.audioEnabled ? {} : styles.controlBtnOff),
              }}
              title={webRTC.audioEnabled ? 'Couper le micro' : 'Activer le micro'}
            >
              {webRTC.audioEnabled ? '🎤' : '🔇'}
            </button>
            {webRTC.screenStream ? (
              <button type="button" onClick={webRTC.stopScreenShare} style={styles.controlBtn}>
                Arrêter partage écran
              </button>
            ) : (
              <button type="button" onClick={webRTC.startScreenShare} style={styles.controlBtn}>
                Partager l'écran
              </button>
            )}
          </div>
        </section>

        <aside style={styles.sidebar}>
          <div style={styles.tabs}>
            {(['chat', 'whiteboard', 'files'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  ...styles.tab,
                  ...(activeTab === tab ? styles.tabActive : {}),
                }}
              >
                {tab === 'chat' && '💬 Chat'}
                {tab === 'whiteboard' && '✏️ Tableau blanc'}
                {tab === 'files' && '📁 Fichiers'}
              </button>
            ))}
          </div>
          <div style={styles.panel}>
            {activeTab === 'chat' && (
              <Chat
                messages={chatMessages}
                onSend={sendChatMessage}
                displayName={displayName}
                roomId={roomId}
              />
            )}
            {activeTab === 'whiteboard' && (
              <Whiteboard
                strokes={whiteboardStrokes}
                onStroke={sendWhiteboardStroke}
                peerId={peerId}
              />
            )}
            {activeTab === 'files' && (
              <SharedFiles roomId={roomId} apiBase={apiBase} displayName={displayName} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function LocalVideo({
  stream,
  screenStream,
  displayName,
  videoEnabled,
}: {
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  displayName: string;
  videoEnabled: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
    videoRef.current.srcObject = stream;
  }
  if (screenRef.current && screenStream && screenRef.current.srcObject !== screenStream) {
    screenRef.current.srcObject = screenStream;
  }
  return (
    <div style={styles.videoTile}>
      <div style={styles.videoWrap}>
        {screenStream ? (
          <video ref={screenRef} autoPlay muted playsInline style={styles.video} />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={styles.video}
            className={!videoEnabled ? 'hidden' : ''}
          />
        )}
        {!videoEnabled && !screenStream && (
          <div style={styles.videoPlaceholder}>Caméra coupée</div>
        )}
      </div>
      <span style={styles.videoLabel}>Vous · {displayName}</span>
    </div>
  );
}

function RemoteVideo({
  peerId,
  stream,
  screenStream,
}: {
  peerId: string;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
    videoRef.current.srcObject = stream;
  }
  if (screenRef.current && screenStream && screenRef.current.srcObject !== screenStream) {
    screenRef.current.srcObject = screenStream;
  }
  return (
    <div style={styles.videoTile}>
      <div style={styles.videoWrap}>
        {screenStream && (
          <video ref={screenRef} autoPlay playsInline style={styles.video} />
        )}
        {stream && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={styles.video}
          />
        )}
        {!stream && !screenStream && (
          <div style={styles.videoPlaceholder}>En attente…</div>
        )}
      </div>
      <span style={styles.videoLabel}>{peerId.slice(0, 8)}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  title: { margin: 0, fontSize: '1.1rem', flex: 1 },
  badge: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  leaveBtn: {
    padding: '0.5rem 1rem',
    background: 'var(--danger)',
    color: '#fff',
    borderRadius: 'var(--radius)',
  },
  main: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
  },
  videoSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  videoGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '0.5rem',
    padding: '0.5rem',
    overflow: 'auto',
  },
  videoTile: {
    position: 'relative',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: 'var(--surface)',
    aspectRatio: '16/10',
  },
  videoWrap: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoPlaceholder: {
    padding: '1rem',
    color: 'var(--text-muted)',
    background: 'var(--surface-hover)',
  },
  videoLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0.25rem 0.5rem',
    background: 'rgba(0,0,0,0.6)',
    fontSize: '0.8rem',
  },
  controls: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    justifyContent: 'center',
    borderTop: '1px solid var(--border)',
  },
  controlBtn: {
    padding: '0.5rem 1rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    borderRadius: 'var(--radius)',
  },
  controlBtnOff: { opacity: 0.7 },
  sidebar: {
    width: 380,
    minWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    flex: 1,
    padding: '0.75rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  tabActive: {
    background: 'var(--surface-hover)',
    color: 'var(--text)',
  },
  panel: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
};
