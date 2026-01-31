import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/signaling`;

export type SignalingMessage = {
  type: string;
  roomId: string;
  fromPeerId?: string;
  toPeerId?: string;
  payload?: unknown;
};

type UseSignalingOptions = {
  roomId: string;
  peerId: string;
  onMessage?: (msg: SignalingMessage) => void;
};

export function useSignaling({ roomId, peerId, onMessage }: UseSignalingOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((msg: Partial<SignalingMessage>) => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return;
    w.send(JSON.stringify({ roomId, fromPeerId: peerId, ...msg }));
  }, [roomId, peerId]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      send({ type: 'join', roomId, fromPeerId: peerId });
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as SignalingMessage;
        if (msg.roomId !== roomId) return;
        onMessageRef.current?.(msg);
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [roomId, peerId]); // send not in deps to avoid reconnecting on send change

  return { connected, send };
}
