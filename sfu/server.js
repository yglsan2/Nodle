/**
 * SFU Nodle – mediasoup.
 * Permet à une salle de 10–20+ participants de se connecter sans mesh (un flux montant par client, N flux descendants).
 * À lancer en parallèle du backend Java ; configurer nodle.sfu.ws-url dans application.properties.
 * Règle de robustesse : 1 try, 1 catch, 1 finally par bloc critique.
 * @module sfu/server
 */
import mediasoup from 'mediasoup';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 3001;
const WS_PATH = process.env.WS_PATH || '/';
const PREFIX = '[Nodle][SFU]';

const workers = [];
let nextWorkerIdx = 0;

function log(level, ...args) {
  try {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(PREFIX, ...args);
  } catch (_) {}
}

/**
 * Crée un worker mediasoup (thread dédié au traitement RTP).
 * @returns {Promise<Worker>}
 */
async function createWorker() {
  try {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
    });
    worker.on('died', () => {
      try {
        log('error', 'Worker died');
        process.exit(1);
      } catch (e) {
        log('error', 'died handler', e);
      } finally {
        // no cleanup
      }
    });
    log('info', 'worker created');
    return worker;
  } catch (e) {
    log('error', 'createWorker failed', e);
    throw e;
  } finally {
    // no cleanup
  }
}

async function run() {
  try {
    const worker = await createWorker();
    workers.push(worker);

    const rooms = new Map();

    /**
     * Retourne la salle (router + peers) pour un roomId, en la créant si besoin.
     * @param {string} roomId
     * @returns {{ router: object|null, peers: Map }}
     */
    function getOrCreateRouter(roomId) {
      try {
        let r = rooms.get(roomId);
        if (!r) {
          r = { router: null, peers: new Map(), pendingRouterCapabilities: null };
          rooms.set(roomId, r);
          log('info', 'room created', roomId);
        }
        return r;
      } catch (e) {
        log('error', 'getOrCreateRouter failed', roomId, e);
        throw e;
      } finally {
        // no cleanup
      }
    }

    const wss = new WebSocketServer({ port: PORT, path: WS_PATH }, () => {
      try {
        log('info', 'listening ws://localhost:' + PORT + WS_PATH);
      } catch (e) {
        log('error', 'listen callback', e);
      } finally {
        // no cleanup
      }
    });

    wss.on('connection', (ws, req) => {
      let url;
      try {
        url = new URL(req.url || '', `http://localhost`);
      } catch (e) {
        log('warn', 'URL parse failed', e?.message);
        ws.close();
        return;
      } finally {
        // no cleanup
      }
      const roomId = url.searchParams.get('roomId') || 'default';
      const peerId = url.searchParams.get('peerId') || `peer-${Date.now()}`;

      const room = getOrCreateRouter(roomId);
      const peer = {
        id: peerId,
        ws,
        sendTransport: null,
        recvTransport: null,
        producers: new Map(),
        consumers: new Map(),
      };
      room.peers.set(peerId, peer);
      log('info', 'peer connected', roomId, peerId);

      /**
       * Envoie un message JSON au client.
       * @param {string} type
       * @param {object} data
       */
      function send(type, data = {}) {
        try {
          ws.send(JSON.stringify({ type, ...data }));
        } catch (e) {
          log('warn', 'send failed', type, e?.message);
        } finally {
          // no cleanup
        }
      }

      ws.on('message', async (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch (e) {
          log('warn', 'message parse error', e?.message);
          return;
        } finally {
          // no cleanup
        }
        const { type } = msg;

        try {
          if (type === 'getRouterRtpCapabilities') {
            try {
              if (!room.router) {
                room.router = await worker.createRouter({
                  mediaCodecs: [
                    { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
                    { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 },
                    { kind: 'video', mimeType: 'video/H264', clockRate: 90000 },
                  ],
                });
                log('info', 'router created', roomId);
              }
              const existingProducers = [];
              for (const [pid, p] of room.peers) {
                if (pid === peerId) continue;
                for (const [prodId, prod] of p.producers) {
                  existingProducers.push({ peerId: pid, producerId: prodId, kind: prod.kind });
                }
              }
              send('routerRtpCapabilities', {
                rtpCapabilities: room.router.rtpCapabilities,
                existingProducers,
              });
              log('info', 'routerRtpCapabilities sent', peerId);
            } catch (e) {
              log('error', 'getRouterRtpCapabilities failed', e);
              send('error', { message: e?.message || 'Router error' });
            } finally {
              // no cleanup
            }
            return;
          }

          if (type === 'createWebRtcTransport' && msg.direction) {
            try {
              const transport = await room.router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedAddress: undefined }],
                enableUdp: true,
                enableTcp: true,
              });
              if (msg.direction === 'send') peer.sendTransport = transport;
              else peer.recvTransport = transport;
              transport.on('dtlsstatechange', (state) => {
                try {
                  if (state === 'closed') transport.close();
                } catch (e) {
                  log('warn', 'dtlsstatechange close', e?.message);
                } finally {
                  // no cleanup
                }
              });
              send('webRtcTransportCreated', {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
              });
            } catch (e) {
              log('warn', 'createWebRtcTransport failed', e?.message);
              send('error', { message: e?.message });
            } finally {
              // no cleanup
            }
            return;
          }

          if (type === 'connectWebRtcTransport' && msg.transportId && msg.dtlsParameters) {
            try {
              const transport =
                peer.sendTransport?.id === msg.transportId ? peer.sendTransport : peer.recvTransport;
              if (transport) {
                await transport.connect({ dtlsParameters: msg.dtlsParameters });
                send('transportConnected', { transportId: msg.transportId });
              }
            } catch (e) {
              log('warn', 'connectWebRtcTransport failed', e?.message);
              send('error', { message: e?.message });
            } finally {
              // no cleanup
            }
            return;
          }

          if (type === 'produce' && msg.transportId && msg.kind && msg.rtpParameters) {
            try {
              const transport = peer.sendTransport?.id === msg.transportId ? peer.sendTransport : null;
              if (!transport) return;
              const producer = await transport.produce({
                kind: msg.kind,
                rtpParameters: msg.rtpParameters,
              });
              peer.producers.set(producer.id, producer);
              send('produced', { id: producer.id, kind: producer.kind });
              for (const [otherId, other] of room.peers) {
                if (otherId === peerId) continue;
                try {
                  other.ws.send(JSON.stringify({ type: 'newProducer', peerId, producerId: producer.id, kind: producer.kind }));
                } catch (e) {
                  log('warn', 'newProducer broadcast failed', otherId, e?.message);
                } finally {
                  // no cleanup
                }
              }
              log('info', 'produce ok', peerId, msg.kind);
            } catch (e) {
              log('warn', 'produce failed', e?.message);
              send('error', { message: e?.message });
            } finally {
              // no cleanup
            }
            return;
          }

          if (type === 'consume' && msg.producerId && msg.rtpCapabilities) {
            try {
              let producer = null;
              for (const p of room.peers.values()) {
                producer = p.producers.get(msg.producerId);
                if (producer) break;
              }
              if (!producer || !peer.recvTransport) {
                send('error', { message: 'Producer not found or no recv transport' });
                return;
              }
              const consumer = await peer.recvTransport.consume({
                producerId: producer.id,
                rtpCapabilities: msg.rtpCapabilities,
                paused: false,
              });
              peer.consumers.set(consumer.id, consumer);
              send('consumed', {
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
              });
              log('info', 'consume ok', peerId, msg.producerId);
            } catch (e) {
              log('warn', 'consume failed', e?.message);
              send('error', { message: e?.message });
            } finally {
              // no cleanup
            }
            return;
          }
        } catch (err) {
          log('warn', 'message handler error', type, err?.message);
          send('error', { message: err?.message });
        } finally {
          // no cleanup
        }
      });

      ws.on('close', () => {
        try {
          if (peer.sendTransport) peer.sendTransport.close();
          if (peer.recvTransport) peer.recvTransport.close();
          room.peers.delete(peerId);
          if (room.peers.size === 0 && room.router) {
            room.router.close();
            rooms.delete(roomId);
            log('info', 'room closed', roomId);
          }
          log('info', 'peer disconnected', roomId, peerId);
        } catch (e) {
          log('error', 'close handler failed', e);
        } finally {
          // no cleanup
        }
      });
    });
  } catch (e) {
    log('error', 'run failed', e);
    throw e;
  } finally {
    // no cleanup
  }
}

try {
  run().catch((err) => {
    console.error(PREFIX, err);
    process.exit(1);
  });
} catch (e) {
  console.error(PREFIX, 'startup failed', e);
  process.exit(1);
} finally {
  // no cleanup
}
