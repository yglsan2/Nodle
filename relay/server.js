/**
 * Relais de signaling Nodle – aucun stockage, juste transfert des messages par roomId.
 * Permet à un petit groupe de se connecter en visio/chat sans héberger le backend Java.
 * Protocole : même format que le backend (type, roomId, fromPeerId, toPeerId, payload).
 * Règle de robustesse : 1 try, 1 catch, 1 finally par bloc critique.
 * @module relay/server
 */

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 9090;
const PREFIX = '[Nodle][Relay]';

const rooms = new Map();

function log(level, ...args) {
  try {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(PREFIX, ...args);
  } catch (_) {}
}

/**
 * Retourne la Map (ws -> peerId) pour une salle, en la créant si besoin.
 * @param {string} roomId - Identifiant de la salle
 * @returns {Map} room
 */
function getRoom(roomId) {
  try {
    let r = rooms.get(roomId);
    if (!r) {
      r = new Map();
      rooms.set(roomId, r);
      log('info', 'room created', roomId);
    }
    return r;
  } catch (e) {
    log('error', 'getRoom failed', roomId, e);
    throw e;
  } finally {
    // no cleanup
  }
}

const wss = new WebSocketServer({ port: PORT }, () => {
  try {
    log('info', 'listening ws://localhost:' + PORT);
  } catch (e) {
    log('error', 'listen callback', e);
  } finally {
    // no cleanup
  }
});

wss.on('connection', (ws, req) => {
  let peerId = null;
  let roomId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      log('warn', 'message parse error', e?.message);
      return;
    } finally {
      // no cleanup
    }

    const rid = msg.roomId;
    if (!rid || typeof rid !== 'string') return;

    if (!roomId) {
      try {
        roomId = rid;
        peerId = msg.fromPeerId || `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const room = getRoom(roomId);
        room.set(ws, peerId);
        ws.peerId = peerId;
        log('info', 'peer joined', roomId, peerId);
      } catch (e) {
        log('error', 'join failed', e);
      } finally {
        // no cleanup
      }
    }

    if (msg.type === 'ping') {
      try {
        ws.send(JSON.stringify({ type: 'pong', roomId: msg.roomId }));
        log('info', 'pong sent', peerId);
      } catch (e) {
        log('warn', 'pong send failed', e?.message);
      } finally {
        // no cleanup
      }
      return;
    }

    const room = getRoom(roomId);
    if (msg.type === 'join') {
      try {
        const otherPeerIds = [];
        room.forEach((peerIdVal, otherWs) => {
          if (otherWs === ws || !otherWs || otherWs.readyState !== 1) return;
          otherPeerIds.push(peerIdVal);
        });
        ws.send(JSON.stringify({ type: 'peersInRoom', roomId, fromPeerId: peerId, payload: { peerIds: otherPeerIds } }));
        log('info', 'peersInRoom sent', peerId, otherPeerIds.length);
      } catch (e) {
        log('warn', 'peersInRoom send failed', e?.message);
      } finally {
        // no cleanup
      }
    }

    try {
      const excludeId = msg.toPeerId ? null : ws.peerId;
      room.forEach((peerIdVal, otherWs) => {
        if (otherWs === ws || !otherWs || otherWs.readyState !== 1) return;
        if (excludeId && peerIdVal === excludeId) return;
        if (msg.toPeerId && peerIdVal !== msg.toPeerId) return;
        try {
          otherWs.send(JSON.stringify(msg));
        } catch (e) {
          log('warn', 'broadcast send failed', peerIdVal, e?.message);
        } finally {
          // no cleanup
        }
      });
    } catch (e) {
      log('error', 'broadcast failed', e);
    } finally {
      // no cleanup
    }
  });

  ws.on('close', () => {
    try {
      if (roomId) {
        const room = getRoom(roomId);
        room.delete(ws);
        if (room.size === 0) rooms.delete(roomId);
        log('info', 'peer left', roomId, peerId);
      }
    } catch (e) {
      log('error', 'close handler failed', e);
    } finally {
      roomId = null;
      peerId = null;
    }
  });
});
