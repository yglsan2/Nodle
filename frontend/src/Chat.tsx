import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from './types';
import { GifPicker } from './GifPicker';
import { useServerConfig } from './serverConfig';
import { useSettings } from './settings';

type TypingPeer = { peerId: string; displayName: string };

type RemotePeerForChat = { peerId: string; displayName: string };

type Props = {
  messages: ChatMessage[];
  onSend: (msg: Omit<ChatMessage, 'id' | 'fromPeerId' | 'at'>) => void;
  onTyping?: (active: boolean) => void;
  typingPeers?: TypingPeer[];
  displayName: string;
  roomId: string;
  myPeerId?: string;
  /** Liste des participants pour le message privé (à qui envoyer). */
  remotePeers?: RemotePeerForChat[];
};


function playNewMessageSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {}
}

const TYPING_DEBOUNCE_MS = 400;
const TYPING_STOP_MS = 2000;

export function Chat({ messages, onSend, onTyping, typingPeers = [], displayName, roomId, myPeerId, remotePeers = [] }: Props) {
  const { apiBase } = useServerConfig();
  const { settings } = useSettings();
  const apiRoomFiles = useMemo(() => `${apiBase}/rooms/${roomId}/files`, [apiBase, roomId]);
  const soundOnNewMessage = settings?.notifications?.soundOnNewMessage ?? true;

  const [text, setText] = useState('');
  const [codeBlock, setCodeBlock] = useState<{ lang: string; code: string } | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  /** null = à tout le monde, sinon peerId du destinataire pour message privé */
  const [toPeerId, setToPeerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!soundOnNewMessage || messages.length <= prevCountRef.current || !myPeerId) {
      prevCountRef.current = messages.length;
      return;
    }
    const last = messages[messages.length - 1];
    if (last && last.fromPeerId !== myPeerId) playNewMessageSound();
    prevCountRef.current = messages.length;
  }, [messages, myPeerId, soundOnNewMessage]);

  // Indicateur « écrit en cours » : debounce + arrêt auto
  useEffect(() => {
    if (!onTyping) return;
    const hasContent = text.trim().length > 0;
    if (!hasContent) {
      onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      return;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
      onTyping(true);
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      typingStopRef.current = setTimeout(() => {
        typingStopRef.current = null;
        onTyping(false);
      }, TYPING_STOP_MS);
    }, TYPING_DEBOUNCE_MS);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
    };
  }, [text, onTyping]);

  const sendText = useCallback(() => {
    const t = text.trim();
    if (!t && !codeBlock) return;
    onTyping?.(false);
    const base = { displayName, toPeerId: toPeerId ?? undefined };
    if (codeBlock) {
      onSend({ ...base, codeBlock: { lang: codeBlock.lang, code: codeBlock.code } });
      setCodeBlock(null);
    } else {
      onSend({ ...base, text: t });
    }
    setText('');
  }, [text, codeBlock, displayName, toPeerId, onSend, onTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      const form = new FormData();
      form.append('file', file);
      form.append('uploaderName', displayName);
      try {
        const res = await fetch(`${apiRoomFiles}/upload`, {
          method: 'POST',
          body: form,
        });
        if (!res.ok) return;
        const data = await res.json();
        onSend({
          displayName,
          toPeerId: toPeerId ?? undefined,
          attachment: {
            url: data.url ?? `${apiRoomFiles}/download/${data.id}`,
            name: data.name ?? file.name,
            contentType: data.contentType ?? file.type,
          },
        });
      } catch {}
    },
    [apiRoomFiles, displayName, toPeerId, onSend]
  );

  const handleGifSelect = useCallback(
    (url: string) => {
      onSend({ displayName, toPeerId: toPeerId ?? undefined, gifUrl: url });
      setShowGifPicker(false);
    },
    [displayName, toPeerId, onSend]
  );

  const addCodeBlock = useCallback(() => {
    const lang = window.prompt('Langage (ex. js, python):', 'texte') ?? 'texte';
    const code = window.prompt('Collez le code ou le texte:') ?? '';
    if (code) setCodeBlock({ lang, code });
  }, []);

  const sendCodeBlock = useCallback(() => {
    if (codeBlock) {
      onSend({ displayName, toPeerId: toPeerId ?? undefined, codeBlock });
      setCodeBlock(null);
    }
  }, [codeBlock, displayName, toPeerId, onSend]);

  const groupedMessages = useMemo(() => {
    const groups: ChatMessage[][] = [];
    const MAX_GAP_MS = 120000;
    for (const m of messages) {
      const last = groups[groups.length - 1];
      if (last && last[0].fromPeerId === m.fromPeerId && last[0].displayName === m.displayName && m.at - last[last.length - 1].at < MAX_GAP_MS) {
        last.push(m);
      } else {
        groups.push([m]);
      }
    }
    return groups;
  }, [messages]);

  return (
    <div style={styles.container}>
      <div ref={listRef} style={styles.messageList}>
        {messages.length === 0 && (
          <p style={styles.emptyState}>Aucun message. Écrivez quelque chose ou envoyez un GIF !</p>
        )}
        {groupedMessages.map((group) => (
          <ChatMessageGroup key={group[0].id} messages={group} myPeerId={myPeerId} />
        ))}
        {typingPeers.length > 0 && (
          <div style={styles.typingRow}>
            <span style={styles.typingDots}>...</span>
            <span style={styles.typingText}>
              {typingPeers.map((p) => p.displayName || p.peerId.slice(0, 8)).join(', ')} en train d'écrire
            </span>
          </div>
        )}
      </div>

      {codeBlock && (
        <div style={styles.codeBlockEditor}>
          <pre style={styles.codePreview}>
            <code>{codeBlock.code.slice(0, 80)}{codeBlock.code.length > 80 ? '…' : ''}</code>
          </pre>
          <button type="button" onClick={sendCodeBlock} style={styles.sendCodeBtn}>
            Envoyer le bloc
          </button>
          <button type="button" onClick={() => setCodeBlock(null)} style={styles.cancelBtn}>
            Annuler
          </button>
        </div>
      )}

      <div style={styles.inputRow}>
        {remotePeers.length > 0 && (
          <select
            value={toPeerId ?? ''}
            onChange={(e) => setToPeerId(e.target.value || null)}
            style={styles.recipientSelect}
            title="Envoyer à tout le monde ou en message privé"
          >
            <option value="">À tout le monde</option>
            {remotePeers.map((p) => (
              <option key={p.peerId} value={p.peerId}>Privé à {p.displayName}</option>
            ))}
          </select>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept=".pdf,.txt,.md,.rtf,.doc,.docx,.odt,.ott,.xls,.xlsx,.ods,.ots,.csv,.ppt,.pptx,.odp,.otp,.odg,.otg,.odc,.odf,.odb,.odm,.odi,.oth,.otf,.png,.jpg,.jpeg,.gif,.webp,.svg,.eps,.ai,.psd,.sketch,.xd,.drawio,.vsdx,.vsd,.excalidraw,.xml,.loo,.mcd,.merise,.cdm,.bpmn,.xmi,.uml,.er,.erd,.blend,.obj,.stl,.3ds,.dae,.step,.stp,.iges,.igs,.glb,.gltf,.dxf,.dwg,.json,.sql,.yaml,.yml,.toml,.xmind,.mm,.opml,.tex,.epub,.zip,.tar,.gz,.py,.js,.ts,.jsx,.tsx,.vue,.html,.css,.scss,.java,.c,.cpp,.h,.rs,.go,.php,.rb,.sh,.bat,.kt,.swift,.mp3,.mp4,.webm,.ogg,.wav,.m4a,.ttf,.otf,.woff,.woff2"
        />
        <button type="button" onClick={handleAttach} style={styles.iconBtn} title="Pièce jointe">
          📎
        </button>
        <button
          type="button"
          onClick={() => setShowGifPicker((v) => !v)}
          style={styles.iconBtn}
          title="GIF"
        >
          🎬
        </button>
        <button type="button" onClick={addCodeBlock} style={styles.iconBtn} title="Bloc code / texte">
          {'</>'}
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message… (Entrée pour envoyer)"
          style={styles.textInput}
          rows={2}
        />
        <button type="button" onClick={sendText} style={styles.sendBtn}>
          Envoyer
        </button>
      </div>

      {showGifPicker && (
        <GifPicker
          roomId={roomId}
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </div>
  );
}

const ChatMessageRow = React.memo(function ChatMessageRow({
  message,
  showAuthor,
  showTime,
  isPrivate,
}: {
  message: ChatMessage;
  showAuthor: boolean;
  showTime: boolean;
  isPrivate?: boolean;
}) {
  const time = new Date(message.at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={showAuthor ? styles.message : styles.messageCompact}>
      {showAuthor && (
        <div style={styles.messageHead}>
          <strong>{message.displayName}</strong>
          {isPrivate && <span style={styles.privateBadge}>Privé</span>}
          {showTime && <span style={styles.messageTime}>{time}</span>}
        </div)}
      {!showAuthor && showTime && <span style={styles.messageTimeInline}>{time}</span>}
      {message.text && <p style={styles.messageText}>{message.text}</p>}
      {message.gifUrl && <MediaBlock url={message.gifUrl} />}
      {message.attachment && (
        <a href={message.attachment.url} target="_blank" rel="noopener noreferrer" style={styles.attachment}>
          📄 {message.attachment.name}
        </a>
      )}
      {message.codeBlock && (
        <pre style={styles.codeBlock}>
          <code data-lang={message.codeBlock!.lang}>{message.codeBlock!.code}</code>
        </pre>
      )}
    </div>
  );
});

const ChatMessageGroup = React.memo(function ChatMessageGroup({ messages, myPeerId }: { messages: ChatMessage[]; myPeerId?: string }) {
  return (
    <div style={styles.messageGroup}>
      {messages.map((m, i) => (
        <ChatMessageRow
          key={m.id}
          message={m}
          showAuthor={i === 0}
          showTime={i === messages.length - 1}
          isPrivate={!!m.toPeerId}
        />
      ))}
    </div>
  );
});

function MediaBlock({ url }: { url: string }) {
  const ext = url.split('.').pop()?.toLowerCase() ?? '';
  const isVideo = ['mp4', 'webm'].includes(ext);

  if (isVideo) {
    return (
      <video
        src={url}
        autoPlay
        loop
        muted
        playsInline
        style={styles.media}
        controls
      />
    );
  }
  return <img src={url} alt="" style={styles.media} loading="lazy" />;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  messageList: {
    flex: 1,
    overflow: 'auto',
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  emptyState: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    textAlign: 'center',
    margin: '1rem 0',
  },
  typingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.5rem',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  typingDots: { letterSpacing: '0.1em' },
  typingText: {},
  messageGroup: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  message: {
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
  },
  messageCompact: {
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
    padding: '0.35rem 0.75rem',
    fontSize: '0.9rem',
    marginLeft: '0.5rem',
    borderLeft: '3px solid var(--border)',
  },
  messageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', gap: '0.5rem' },
  privateBadge: { fontSize: '0.7rem', color: 'var(--accent)', background: 'rgba(88, 166, 255, 0.15)', padding: '0.1rem 0.35rem', borderRadius: 'var(--radius)' },
  messageTime: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  recipientSelect: {
    padding: '0.35rem 0.5rem',
    fontSize: '0.85rem',
    background: 'var(--surface-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    minWidth: 140,
  },
  messageTimeInline: { fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem' },
  messageText: { margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  attachment: {
    display: 'inline-block',
    marginTop: '0.25rem',
    color: 'var(--accent)',
    fontSize: '0.85rem',
  },
  codeBlock: {
    margin: '0.5rem 0 0',
    padding: '0.5rem',
    background: 'var(--bg)',
    borderRadius: 'var(--radius)',
    overflow: 'auto',
    fontSize: '0.8rem',
    border: '1px solid var(--border)',
  },
  media: {
    maxWidth: '100%',
    maxHeight: 200,
    borderRadius: 'var(--radius)',
    marginTop: '0.25rem',
  },
  codeBlockEditor: {
    padding: '0.5rem',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface-hover)',
  },
  codePreview: {
    margin: '0 0 0.5rem',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sendCodeBtn: { marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.85rem' },
  cancelBtn: { padding: '0.25rem 0.5rem', fontSize: '0.85rem' },
  inputRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    padding: '0.5rem',
    borderTop: '1px solid var(--border)',
    alignItems: 'flex-end',
  },
  iconBtn: {
    padding: '0.4rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    borderRadius: 'var(--radius)',
    fontSize: '1rem',
  },
  textInput: {
    flex: 1,
    minWidth: 120,
    padding: '0.5rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.9rem',
    resize: 'none',
  },
  sendBtn: {
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 'var(--radius)',
  },
};
