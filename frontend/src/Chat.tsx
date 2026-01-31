import { useCallback, useRef, useState } from 'react';
import type { ChatMessage } from './types';
import { GifPicker } from './GifPicker';

type Props = {
  messages: ChatMessage[];
  onSend: (msg: Omit<ChatMessage, 'id' | 'fromPeerId' | 'at'>) => void;
  displayName: string;
  roomId: string;
};

const API_ROOM_FILES = (roomId: string) => `/api/rooms/${roomId}/files`;

export function Chat({ messages, onSend, displayName, roomId }: Props) {
  const [text, setText] = useState('');
  const [codeBlock, setCodeBlock] = useState<{ lang: string; code: string } | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sendText = useCallback(() => {
    const t = text.trim();
    if (!t && !codeBlock) return;
    if (codeBlock) {
      onSend({ displayName, codeBlock: { lang: codeBlock.lang, code: codeBlock.code } });
      setCodeBlock(null);
    } else {
      onSend({ displayName, text: t });
    }
    setText('');
  }, [text, codeBlock, displayName, onSend]);

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
        const res = await fetch(`${API_ROOM_FILES(roomId)}/upload`, {
          method: 'POST',
          body: form,
        });
        if (!res.ok) return;
        const data = await res.json();
        onSend({
          displayName,
          attachment: {
            url: data.url ?? `/api/rooms/${roomId}/files/download/${data.id}`,
            name: data.name ?? file.name,
            contentType: data.contentType ?? file.type,
          },
        });
      } catch {}
    },
    [roomId, displayName, onSend]
  );

  const handleGifSelect = useCallback(
    (url: string) => {
      onSend({ displayName, gifUrl: url });
      setShowGifPicker(false);
    },
    [displayName, onSend]
  );

  const addCodeBlock = useCallback(() => {
    const lang = window.prompt('Langage (ex. js, python):', 'texte') ?? 'texte';
    const code = window.prompt('Collez le code ou le texte:') ?? '';
    if (code) setCodeBlock({ lang, code });
  }, []);

  const sendCodeBlock = useCallback(() => {
    if (codeBlock) {
      onSend({ displayName, codeBlock });
      setCodeBlock(null);
    }
  }, [codeBlock, displayName, onSend]);

  return (
    <div style={styles.container}>
      <div ref={listRef} style={styles.messageList}>
        {messages.map((m) => (
          <ChatMessageRow key={m.id} message={m} />
        ))}
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
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.md,.doc,.docx,.xls,.xlsx,.json,.csv,.drawio"
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

function ChatMessageRow({ message }: { message: ChatMessage }) {
  const time = new Date(message.at).toLocaleTimeString('fr', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={styles.message}>
      <div style={styles.messageHead}>
        <strong>{message.displayName}</strong>
        <span style={styles.messageTime}>{time}</span>
      </div>
      {message.text && <p style={styles.messageText}>{message.text}</p>}
      {message.gifUrl && <MediaBlock url={message.gifUrl} />}
      {message.attachment && (
        <a
          href={message.attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.attachment}
        >
          📄 {message.attachment.name}
        </a>
      )}
      {message.codeBlock && (
        <pre style={styles.codeBlock}>
          <code data-lang={message.codeBlock.lang}>{message.codeBlock.code}</code>
        </pre>
      )}
    </div>
  );
}

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
  message: {
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
  },
  messageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' },
  messageTime: { fontSize: '0.75rem', color: 'var(--text-muted)' },
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
