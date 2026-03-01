/**
 * Hook de signaling WebSocket pour Nodle.
 * Gère la connexion au relais ou au serveur, le heartbeat (ping/pong), la reconnexion
 * avec backoff exponentiel et l'envoi/réception des messages (join, offer, answer, ice, chat, etc.).
 * @module useSignaling
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useServerConfig } from './serverConfig';
import { logger } from './logger';

const CONNECT_TIMEOUT_MS = 8000;
const MAX_RECONNECT_ATTEMPTS = 15;
const HEARTBEAT_INTERVAL_MS = 20000;
const HEARTBEAT_REPLY_TIMEOUT_MS = 8000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

const MODULE = 'Signaling';

/** Message échangé sur le canal de signaling (JSON). */
export type SignalingMessage = {
  type: string;
  roomId: string;
  fromPeerId?: string;
  toPeerId?: string;
  payload?: unknown;
};

/** Mode de connexion affiché à l'utilisateur (relais vs serveur). */
export type ConnectionMode = 'relay' | 'server' | 'connecting';

/** Options du hook useSignaling. */
type UseSignalingOptions = {
  roomId: string;
  peerId: string;
  displayName?: string;
  role?: 'teacher' | 'student' | 'participant';
  /**
   * Liste d'URLs de signaling à essayer dans l'ordre (hybride).
   * Si la première échoue (timeout, erreur), on passe à la suivante sans bloquer l'app.
   */
  wsUrls?: string[];
  onMessage?: (msg: SignalingMessage) => void;
};

/**
 * Construit l'URL WebSocket par défaut à partir de l'origine configurée.
 * @param wsOrigin - Origine du serveur (ex. https://example.com)
 * @returns URL complète du endpoint /ws/signaling
 */
function buildDefaultWsUrl(wsOrigin: string): string {
  try {
    const base = wsOrigin || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
    return base.replace(/\/$/, '') + '/ws/signaling';
  } catch (e) {
    logger.error(MODULE, 'buildDefaultWsUrl failed', e);
    return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/signaling`;
  } finally {
    // rien à libérer
  }
}

/**
 * Résout la liste d'URLs à utiliser (hybride ou défaut).
 * @param wsUrls - URLs optionnelles
 * @param defaultWsUrl - URL par défaut
 * @returns Liste non vide d'URLs
 */
function resolveUrls(wsUrls: string[] | undefined, defaultWsUrl: string): string[] {
  try {
    if (!wsUrls || wsUrls.length === 0) return [defaultWsUrl];
    const out: string[] = [];
    for (const u of wsUrls) {
      const t = u?.trim();
      out.push(t ? t : defaultWsUrl);
    }
    return out;
  } catch (e) {
    logger.warn(MODULE, 'resolveUrls fallback', e);
    return [defaultWsUrl];
  } finally {
    // no cleanup
  }
}

/**
 * Détermine le mode de connexion (relay ou server) à partir de l'URL connectée.
 * @param connectedUrl - URL du WebSocket connecté
 * @param wsOrigin - Origine du serveur API
 * @returns 'relay' | 'server' | 'connecting'
 */
function getConnectionMode(connectedUrl: string, wsOrigin: string): ConnectionMode {
  try {
    const u = new URL(connectedUrl);
    if (u.host === location.host) return 'server';
    if (wsOrigin) {
      const o = new URL(wsOrigin);
      if (u.host === o.host) return 'server';
    }
    return 'relay';
  } catch (e) {
    logger.warn(MODULE, 'getConnectionMode parse error', e);
    return 'server';
  } finally {
    // no cleanup
  }
}

/**
 * Hook React : connexion WebSocket de signaling, reconnexion automatique, heartbeat.
 * @param options - roomId, peerId, displayName, role, wsUrls, onMessage
 * @returns { connected, connectionError, connectionMode, send }
 */
export function useSignaling({ roomId, peerId, displayName, role, wsUrls, onMessage }: UseSignalingOptions) {
  const { wsOrigin } = useServerConfig();
  const defaultWsUrl = buildDefaultWsUrl(wsOrigin);

  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const currentUrlIndexRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((msg: Partial<SignalingMessage>) => {
    try {
      const w = wsRef.current;
      if (!w || w.readyState !== WebSocket.OPEN) {
        logger.warn(MODULE, 'send skipped: not open', w?.readyState);
        return;
      }
      w.send(JSON.stringify({ roomId, fromPeerId: peerId, ...msg }));
      logger.info(MODULE, 'send', msg.type ?? 'unknown');
    } catch (e) {
      logger.error(MODULE, 'send failed', e);
    } finally {
      // no cleanup for send
    }
  }, [roomId, peerId]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let connectTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
    let heartbeatReplyTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const urls = resolveUrls(wsUrls, defaultWsUrl);
    const hadOpenRef = { current: false };

    function clearHeartbeat() {
      try {
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId);
          heartbeatIntervalId = null;
          logger.info(MODULE, 'heartbeat cleared');
        }
        if (heartbeatReplyTimeoutId) {
          clearTimeout(heartbeatReplyTimeoutId);
          heartbeatReplyTimeoutId = null;
        }
      } catch (e) {
        logger.warn(MODULE, 'clearHeartbeat error', e);
      } finally {
        // ids already nulled
      }
    }

    function getReconnectDelay(): number {
      try {
        const n = reconnectAttemptsRef.current;
        return Math.min(RECONNECT_BASE_MS * Math.pow(2, n), RECONNECT_MAX_MS);
      } catch {
        return RECONNECT_BASE_MS;
      } finally {
        // no cleanup
      }
    }

    const tryNext = () => {
      try {
        currentUrlIndexRef.current += 1;
        reconnectAttemptsRef.current = 0;
        if (currentUrlIndexRef.current < urls.length) {
          logger.info(MODULE, 'tryNext: switching URL', currentUrlIndexRef.current, urls.length);
          setConnectionError('Passage au mode serveur…');
          timeoutId = setTimeout(connect, 800);
        } else {
          logger.warn(MODULE, 'tryNext: all URLs failed');
          setConnectionError('Connexion impossible. Relais et serveur ont échoué. Réessayez ou vérifiez votre réseau.');
          setConnectionMode('connecting');
        }
      } catch (e) {
        logger.error(MODULE, 'tryNext failed', e);
      } finally {
        // state already updated
      }
    };

    const connect = () => {
      try {
        setConnectionError(null);
        setConnectionMode('connecting');
        hadOpenRef.current = false;
        const idx = currentUrlIndexRef.current;
        const url = urls[idx];
        logger.info(MODULE, 'connect attempt', idx + 1, urls.length, url?.slice(0, 50));
        const ws = new WebSocket(url);
        wsRef.current = ws;

        connectTimeoutId = setTimeout(() => {
          try {
            if (ws.readyState !== WebSocket.OPEN) {
              logger.warn(MODULE, 'connect timeout, closing');
              ws.close();
            }
          } catch (e) {
            logger.error(MODULE, 'connectTimeout handler', e);
          } finally {
            // no cleanup
          }
        }, CONNECT_TIMEOUT_MS);

        ws.onopen = () => {
          try {
            if (connectTimeoutId) clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
            hadOpenRef.current = true;
            setConnected(true);
            setConnectionError(null);
            reconnectAttemptsRef.current = 0;
            setConnectionMode(getConnectionMode(url, wsOrigin));
            const joinPayload = { displayName: displayName ?? 'Participant', role: role ?? 'participant' };
            ws.send(JSON.stringify({ roomId, fromPeerId: peerId, type: 'join', payload: joinPayload }));
            logger.info(MODULE, 'connected, join sent', url?.slice(0, 50));

            clearHeartbeat();
            heartbeatIntervalId = setInterval(() => {
              try {
                const w = wsRef.current;
                if (!w || w.readyState !== WebSocket.OPEN) return;
                w.send(JSON.stringify({ roomId, fromPeerId: peerId, type: 'ping' }));
                heartbeatReplyTimeoutId = setTimeout(() => {
                  try {
                    logger.warn(MODULE, 'heartbeat reply timeout, closing');
                    w.close();
                  } catch (e) {
                    logger.error(MODULE, 'heartbeat timeout close', e);
                  } finally {
                    heartbeatReplyTimeoutId = null;
                  }
                }, HEARTBEAT_REPLY_TIMEOUT_MS);
              } catch (e) {
                logger.warn(MODULE, 'heartbeat ping error', e);
              } finally {
                // no cleanup in interval
              }
            }, HEARTBEAT_INTERVAL_MS);
          } catch (e) {
            logger.error(MODULE, 'onopen failed', e);
          } finally {
            // timeouts managed above
          }
        };

        ws.onclose = () => {
          try {
            clearHeartbeat();
            if (connectTimeoutId) clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
            wsRef.current = null;
            setConnected(false);
            logger.info(MODULE, 'closed', hadOpenRef.current ? 'had been open' : 'never open');
            if (!hadOpenRef.current) {
              tryNext();
              return;
            }
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttemptsRef.current += 1;
              const delay = getReconnectDelay();
              logger.info(MODULE, 'reconnect scheduled', reconnectAttemptsRef.current, MAX_RECONNECT_ATTEMPTS, delay);
              setConnectionError(`Connexion perdue. Reconnexion (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) dans ${Math.round(delay / 1000)} s…`);
              timeoutId = setTimeout(connect, delay);
            } else {
              tryNext();
            }
          } catch (e) {
            logger.error(MODULE, 'onclose handler failed', e);
          } finally {
            // refs cleared above
          }
        };

        ws.onerror = () => {
          try {
            logger.warn(MODULE, 'WebSocket error');
            setConnectionError('Erreur de connexion.');
          } catch (e) {
            logger.error(MODULE, 'onerror handler', e);
          } finally {
            // no cleanup
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as SignalingMessage & { type?: string };
            if (msg.type === 'pong') {
              if (heartbeatReplyTimeoutId) {
                clearTimeout(heartbeatReplyTimeoutId);
                heartbeatReplyTimeoutId = null;
              }
              return;
            }
            if (msg.roomId !== roomId) return;
            onMessageRef.current?.(msg);
          } catch (e) {
            logger.warn(MODULE, 'onmessage parse/callback error', e);
          } finally {
            // no cleanup
          }
        };
      } catch (e) {
        logger.error(MODULE, 'connect failed', e);
        setConnectionError('Erreur de connexion.');
      } finally {
        // ws ref set above
      }
    };

    currentUrlIndexRef.current = 0;
    reconnectAttemptsRef.current = 0;
    connect();

    return () => {
      try {
        clearHeartbeat();
        if (timeoutId) clearTimeout(timeoutId);
        if (connectTimeoutId) clearTimeout(connectTimeoutId);
        const w = wsRef.current;
        if (w) w.close();
        wsRef.current = null;
        setConnected(false);
        setConnectionError(null);
        setConnectionMode('connecting');
        logger.info(MODULE, 'effect cleanup');
      } catch (e) {
        logger.error(MODULE, 'effect cleanup error', e);
      } finally {
        timeoutId = null;
        connectTimeoutId = null;
      }
    };
  }, [roomId, peerId, displayName, role, wsUrls, defaultWsUrl, wsOrigin]);

  return { connected, connectionError, connectionMode, send };
}
