/**
 * Hook WebRTC P2P pour Nodle : gestion des RTCPeerConnection, flux locaux/distances,
 * offre/réponse/ICE, partage d'écran, et synchronisation avec le signaling.
 * @module useWebRTC
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SignalingMessage } from './useSignaling';
import { logger } from './logger';
import { buildVideoConstraints as buildVideoFromSettings, buildAudioConstraints as buildAudioFromSettings } from './settings/mediaConstraints';
import type { VideoSettings, AudioSettings } from './settings/types';

const MODULE = 'WebRTC';

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

/** État de la connexion WebRTC avec un pair. */
export type PeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

/** Représentation d'un pair distant (flux, états micro/caméra, rôle, connexion). */
export type RemotePeer = {
  peerId: string;
  displayName?: string;
  video: boolean;
  audio: boolean;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  role?: 'teacher' | 'student' | 'participant';
  /** État de la connexion (pour afficher "Connexion perdue" + Réessayer). */
  connectionState?: PeerConnectionState;
};

/** Réglages médias optionnels (sinon défauts légers). */
export type MediaSettingsOption = {
  video: VideoSettings;
  audio: AudioSettings;
};

/** Options du hook useWebRTC. */
export type UseWebRTCOptions = {
  roomId: string;
  localPeerId: string;
  displayName: string;
  signalingSend: (msg: Partial<SignalingMessage>) => void;
  onPeersList?: (peerIds: string[]) => void;
  iceServers?: RTCIceServer[];
  /** Réglages vidéo/audio (qualité, écho, bruit, etc.) – niveau Teams/Zoom */
  mediaSettings?: MediaSettingsOption;
  /** Démarrer avec la caméra coupée (mode audio seul). */
  initialVideoEnabled?: boolean;
};

/** Contraintes vidéo de repli (sans réglages). */
function getVideoConstraintsFallback(remoteCount: number): MediaTrackConstraints {
  if (remoteCount >= 12) return { width: { max: 320 }, height: { max: 240 }, frameRate: { max: 15 } };
  if (remoteCount >= 6) return { width: { max: 640 }, height: { max: 480 }, frameRate: { max: 24 } };
  return { width: { ideal: 1280 }, height: { ideal: 720 } };
}

/**
 * Hook React : WebRTC P2P, création/fermeture des peer connections, gestion des tracks et du signaling.
 * @param options - roomId, localPeerId, displayName, signalingSend, onPeersList, iceServers
 * @returns État et actions (localStream, remotePeers, toggleVideo/Audio, start/stopScreenShare, leave, handleSignalingMessage)
 */
export function useWebRTC({
  roomId,
  localPeerId,
  displayName,
  signalingSend,
  onPeersList,
  iceServers = DEFAULT_ICE_SERVERS,
  mediaSettings,
  initialVideoEnabled = true,
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
  const [videoEnabled, setVideoEnabled] = useState(initialVideoEnabled);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const pcRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const knownPeersRef = useRef<Set<string>>(new Set());
  const failedRetryRef = useRef<Map<string, number>>(new Map());
  const createOfferRef = useRef<(peerId: string) => Promise<void>>(() => Promise.resolve());
  const iceServersRef = useRef(iceServers);
  iceServersRef.current = iceServers;

  const mapConnectionState = (s: RTCPeerConnectionState): PeerConnectionState => {
    if (s === 'new') return 'new';
    if (s === 'connecting') return 'connecting';
    if (s === 'connected') return 'connected';
    if (s === 'disconnected') return 'disconnected';
    if (s === 'failed') return 'failed';
    return 'closed';
  };

  const addRemotePeer = useCallback((peerId: string, updater: (p: RemotePeer) => RemotePeer) => {
    try {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const current = next.get(peerId) ?? {
          peerId,
          video: false,
          audio: false,
          stream: null,
          screenStream: null,
        };
        next.set(peerId, updater(current));
        return next;
      });
    } catch (e) {
      logger.error(MODULE, 'addRemotePeer failed', peerId, e);
    } finally {
      // no cleanup
    }
  }, []);

  const getOrCreatePC = useCallback((peerId: string): RTCPeerConnection => {
    try {
      let pc = pcRef.current.get(peerId);
      if (pc) {
        logger.info(MODULE, 'getOrCreatePC reuse', peerId);
        return pc;
      }

      const servers = iceServersRef.current?.length ? iceServersRef.current : DEFAULT_ICE_SERVERS;
      pc = new RTCPeerConnection({ iceServers: servers });
      pcRef.current.set(peerId, pc);
      knownPeersRef.current.add(peerId);
      try {
        onPeersList?.(Array.from(knownPeersRef.current));
      } catch (e) {
        logger.warn(MODULE, 'onPeersList callback error', e);
      }

      pc.ontrack = (e) => {
        try {
          const stream = e.streams[0];
          if (!stream) return;
          if (e.track.kind === 'video' && e.transceiver?.mid?.startsWith('screen')) {
            addRemotePeer(peerId, (p) => ({ ...p, screenStream: stream }));
          } else {
            addRemotePeer(peerId, (p) => ({ ...p, stream }));
          }
          logger.info(MODULE, 'ontrack', peerId, e.track.kind);
        } catch (err) {
          logger.warn(MODULE, 'ontrack handler failed', peerId, err);
        } finally {
          // no cleanup
        }
      };

      pc.onicecandidate = (e) => {
        try {
          if (e.candidate) {
            signalingSend({ type: 'ice', toPeerId: peerId, payload: e.candidate });
            logger.info(MODULE, 'ice candidate sent', peerId);
          }
        } catch (err) {
          logger.warn(MODULE, 'onicecandidate send failed', peerId, err);
        } finally {
          // no cleanup
        }
      };

      pc.onconnectionstatechange = () => {
        try {
          const state = pc?.connectionState;
          const peerState = state != null ? mapConnectionState(state) : undefined;
          logger.info(MODULE, 'connectionState', peerId, state);
          addRemotePeer(peerId, (p) => ({ ...p, connectionState: peerState }));
          if (state === 'disconnected' || state === 'failed') {
            addRemotePeer(peerId, (p) => ({
              ...p,
              video: false,
              audio: false,
              stream: null,
              screenStream: null,
              connectionState: peerState,
            }));
          }
          if (state === 'failed') {
            const retries = failedRetryRef.current.get(peerId) ?? 0;
            if (retries < 1) {
              failedRetryRef.current.set(peerId, retries + 1);
              setTimeout(() => {
                try {
                  const pcToClose = pcRef.current.get(peerId);
                  if (pcToClose?.connectionState === 'failed') {
                    pcToClose.close();
                    pcRef.current.delete(peerId);
                    setRemotePeers((prev) => {
                      const next = new Map(prev);
                      next.delete(peerId);
                      return next;
                    });
                    createOfferRef.current(peerId);
                    logger.info(MODULE, 'auto-retry offer after failed', peerId);
                  }
                } catch (e) {
                  logger.warn(MODULE, 'auto-retry failed', peerId, e);
                }
              }, 2500);
            }
          }
          if (state === 'connected') {
            failedRetryRef.current.delete(peerId);
          }
          if (state === 'closed') {
            pcRef.current.delete(peerId);
            failedRetryRef.current.delete(peerId);
            setRemotePeers((prev) => {
              const next = new Map(prev);
              next.delete(peerId);
              return next;
            });
            logger.info(MODULE, 'peer removed (closed)', peerId);
          }
        } catch (err) {
          logger.warn(MODULE, 'onconnectionstatechange handler failed', peerId, err);
        } finally {
          // no cleanup
        }
      };

      return pc;
    } catch (e) {
      logger.error(MODULE, 'getOrCreatePC failed', peerId, e);
      throw e;
    } finally {
      // no cleanup
    }
  }, [signalingSend, addRemotePeer, onPeersList]);

  const createOffer = useCallback(async (peerId: string) => {
    try {
      const pc = getOrCreatePC(peerId);
      localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
      if (screenStream) {
        screenStream.getTracks().forEach((t) => pc.addTrack(t, screenStream));
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signalingSend({ type: 'offer', toPeerId: peerId, payload: offer });
      logger.info(MODULE, 'createOffer sent', peerId);
    } catch (err) {
      logger.warn(MODULE, 'createOffer failed', peerId, err);
    } finally {
      // no cleanup
    }
  }, [localStream, screenStream, getOrCreatePC, signalingSend]);

  const handleOffer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    try {
      const pc = getOrCreatePC(from);
      localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
      if (screenStream) screenStream.getTracks().forEach((t) => pc.addTrack(t, screenStream));
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signalingSend({ type: 'answer', toPeerId: from, payload: answer });
      logger.info(MODULE, 'handleOffer answer sent', from);
    } catch (err) {
      logger.warn(MODULE, 'handleOffer failed', from, err);
    } finally {
      // no cleanup
    }
  }, [localStream, screenStream, getOrCreatePC, signalingSend]);

  const handleAnswer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    const pc = pcRef.current.get(from);
    if (!pc) {
      logger.warn(MODULE, 'handleAnswer no pc', from);
      return;
    }
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const pending = pendingCandidatesRef.current.get(from) ?? [];
      for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c));
      pendingCandidatesRef.current.delete(from);
      logger.info(MODULE, 'handleAnswer applied', from);
    } catch (err) {
      logger.warn(MODULE, 'handleAnswer failed', from, err);
    } finally {
      // no cleanup
    }
  }, []);

  const handleIce = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
    try {
      let pc = pcRef.current.get(from);
      if (!pc) {
        getOrCreatePC(from);
        const pending = pendingCandidatesRef.current.get(from) ?? [];
        pendingCandidatesRef.current.set(from, [...pending, candidate]);
        logger.info(MODULE, 'handleIce queued (no pc yet)', from);
        return;
      }
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        logger.info(MODULE, 'handleIce added', from);
      } else {
        const pending = pendingCandidatesRef.current.get(from) ?? [];
        pendingCandidatesRef.current.set(from, [...pending, candidate]);
      }
    } catch (err) {
      logger.warn(MODULE, 'addIceCandidate failed', from, err);
    } finally {
      // no cleanup
    }
  }, [getOrCreatePC]);

  const handlePeersInRoom = useCallback((peerIds: string[]) => {
    try {
      logger.info(MODULE, 'peersInRoom', peerIds.length, peerIds);
      peerIds.forEach((pid) => {
        if (pid === localPeerId) return;
        if (pcRef.current.has(pid)) return;
        createOffer(pid);
      });
    } catch (e) {
      logger.warn(MODULE, 'handlePeersInRoom failed', e);
    } finally {
      // no cleanup
    }
  }, [localPeerId, createOffer]);

  const handleSignalingMessage = useCallback((msg: SignalingMessage) => {
    try {
      if (msg.type === 'peersInRoom') {
        const payload = msg.payload as { peerIds?: string[] } | undefined;
        const list = payload && typeof payload === 'object' && Array.isArray(payload.peerIds) ? payload.peerIds : [];
        handlePeersInRoom(list);
        return;
      }
      if (msg.fromPeerId === localPeerId) return;
      const from = msg.fromPeerId ?? '';
      const payload = msg.payload as RTCSessionDescriptionInit | RTCIceCandidateInit | { displayName?: string; video?: boolean; audio?: boolean; peerIds?: string[] } | undefined;

      switch (msg.type) {
        case 'join': {
          const joinPayload = payload && typeof payload === 'object' ? payload as { displayName?: string; video?: boolean; audio?: boolean; role?: 'teacher' | 'student' | 'participant' } : {};
          addRemotePeer(from, (p) => ({
            ...p,
            displayName: joinPayload.displayName ?? p.displayName ?? from.slice(0, 8),
            video: joinPayload.video ?? true,
            audio: joinPayload.audio ?? true,
            role: joinPayload.role ?? p.role,
          }));
          createOffer(from);
          logger.info(MODULE, 'join handled, offer created', from);
          break;
        }
        case 'muteState': {
          const state = payload && typeof payload === 'object' && 'video' in payload ? payload as { video?: boolean; audio?: boolean } : {};
          addRemotePeer(from, (p) => ({ ...p, video: state.video ?? p.video, audio: state.audio ?? p.audio }));
          break;
        }
        case 'offer':
          if (payload) handleOffer(from, payload as RTCSessionDescriptionInit);
          break;
        case 'answer':
          if (payload) handleAnswer(from, payload as RTCSessionDescriptionInit);
          break;
        case 'ice':
          if (payload) handleIce(from, payload as RTCIceCandidateInit);
          break;
        default:
          break;
      }
    } catch (e) {
      logger.warn(MODULE, 'handleSignalingMessage failed', msg.type, e);
    } finally {
      // no cleanup
    }
  }, [localPeerId, addRemotePeer, createOffer, handleOffer, handleAnswer, handleIce, handlePeersInRoom]);

  useEffect(() => {
    createOfferRef.current = createOffer;
  }, [createOffer]);

  const videoSettingsRef = useRef(mediaSettings?.video);
  videoSettingsRef.current = mediaSettings?.video;
  const audioSettingsRef = useRef(mediaSettings?.audio);
  audioSettingsRef.current = mediaSettings?.audio;

  useEffect(() => {
    let stream: MediaStream | null = null;
    const video = videoSettingsRef.current;
    const audio = audioSettingsRef.current;
    const videoConstraints = video
      ? buildVideoFromSettings(video, 0)
      : getVideoConstraintsFallback(0);
    const audioConstraints = audio
      ? buildAudioFromSettings(audio)
      : { echoCancellation: true, noiseSuppression: true };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });
        if (audioSettingsRef.current?.outputDeviceId && 'sinkId' in HTMLMediaElement.prototype) {
          try {
            const outputId = audioSettingsRef.current.outputDeviceId;
            const el = document.createElement('audio');
            if (el.setSinkId) await el.setSinkId(outputId);
          } catch (_) { /* setSinkId non supporté ou erreur */ }
        }
        setLocalStream(stream);
        logger.info(MODULE, 'getUserMedia ok');
      } catch (e) {
        logger.warn(MODULE, 'getUserMedia failed', e);
        setLocalStream(null);
      } finally {
        // stream assigned or null
      }
    })();
    return () => {
      try {
        stream?.getTracks().forEach((t) => t.stop());
        logger.info(MODULE, 'localStream cleanup');
      } catch (e) {
        logger.warn(MODULE, 'localStream cleanup error', e);
      } finally {
        stream = null;
      }
    };
  }, [mediaSettings?.video?.quality, mediaSettings?.video?.maxFrameRate, mediaSettings?.video?.cameraDeviceId, mediaSettings?.audio?.echoCancellation, mediaSettings?.audio?.noiseSuppression, mediaSettings?.audio?.inputDeviceId]);

  const remoteCount = remotePeers.size;
  const lastRemoteCountRef = useRef(0);
  useEffect(() => {
    try {
      const video = videoSettingsRef.current;
      const adaptive = video?.adaptiveQuality ?? true;
      if (!adaptive && remoteCount > 0) return;
      if (remoteCount < 6 && (!video || video.adaptiveQuality)) return;
      if (!localStream) return;
      const next = video
        ? buildVideoFromSettings(video, remoteCount)
        : getVideoConstraintsFallback(remoteCount);
      const prev = video
        ? buildVideoFromSettings(video, lastRemoteCountRef.current)
        : getVideoConstraintsFallback(lastRemoteCountRef.current);
      if (JSON.stringify(next) === JSON.stringify(prev)) return;
      const videoTrack = localStream.getVideoTracks()[0];
      if (!videoTrack) return;
      videoTrack.applyConstraints(next).catch((e) => logger.warn(MODULE, 'applyConstraints failed', e));
      lastRemoteCountRef.current = remoteCount;
      logger.info(MODULE, 'video constraints updated', remoteCount);
    } catch (e) {
      logger.warn(MODULE, 'constraints effect failed', e);
    } finally {
      // no cleanup
    }
  }, [remoteCount, localStream, mediaSettings?.video]);

  useEffect(() => {
    try {
      if (!localStream) return;
      localStream.getVideoTracks().forEach((t) => { t.enabled = videoEnabled; });
      localStream.getAudioTracks().forEach((t) => { t.enabled = audioEnabled; });
    } catch (e) {
      logger.warn(MODULE, 'mute state sync failed', e);
    } finally {
      // no cleanup
    }
  }, [localStream, videoEnabled, audioEnabled]);

  const toggleVideo = useCallback(() => {
    try {
      setVideoEnabled((v) => {
        const next = !v;
        signalingSend({ type: 'muteState', payload: { video: next, audio: audioEnabled } });
        return next;
      });
    } catch (e) {
      logger.warn(MODULE, 'toggleVideo failed', e);
    } finally {
      // no cleanup
    }
  }, [audioEnabled, signalingSend]);

  const toggleAudio = useCallback(() => {
    try {
      setAudioEnabled((a) => {
        const next = !a;
        signalingSend({ type: 'muteState', payload: { video: videoEnabled, audio: next } });
        return next;
      });
    } catch (e) {
      logger.warn(MODULE, 'toggleAudio failed', e);
    } finally {
      // no cleanup
    }
  }, [videoEnabled, signalingSend]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setScreenStream(stream);
      stream.getVideoTracks()[0].onended = () => setScreenStream(null);
      pcRef.current.forEach((pc) => {
        try {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video' && s.track.id !== localStream?.getVideoTracks()[0]?.id);
          if (sender) sender.replaceTrack(stream.getVideoTracks()[0]);
          else pc.addTrack(stream.getVideoTracks()[0], stream);
        } catch (e) {
          logger.warn(MODULE, 'startScreenShare replaceTrack', e);
        }
      });
      logger.info(MODULE, 'screen share started');
    } catch (e) {
      logger.warn(MODULE, 'getDisplayMedia failed', e);
      setScreenStream(null);
    } finally {
      // no cleanup on failure
    }
  }, [localStream]);

  const stopScreenShare = useCallback(() => {
    try {
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      if (localStream) {
        pcRef.current.forEach((pc) => {
          try {
            const senders = pc.getSenders();
            senders.forEach((s) => {
              if (s.track?.kind === 'video' && s.track.id !== localStream.getVideoTracks()[0]?.id) {
                pc.removeTrack(s);
              }
            });
            pc.addTrack(localStream.getVideoTracks()[0], localStream);
          } catch (e) {
            logger.warn(MODULE, 'stopScreenShare removeTrack', e);
          }
        });
      }
      logger.info(MODULE, 'screen share stopped');
    } catch (e) {
      logger.warn(MODULE, 'stopScreenShare failed', e);
    } finally {
      // no cleanup
    }
  }, [screenStream, localStream]);

  const reconnectPeer = useCallback((peerId: string) => {
    try {
      failedRetryRef.current.delete(peerId);
      const pc = pcRef.current.get(peerId);
      if (pc) {
        pc.close();
        pcRef.current.delete(peerId);
      }
      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
      createOffer(peerId);
      logger.info(MODULE, 'reconnectPeer', peerId);
    } catch (e) {
      logger.warn(MODULE, 'reconnectPeer failed', peerId, e);
    }
  }, [createOffer]);

  const leave = useCallback(() => {
    try {
      localStream?.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
      pcRef.current.forEach((pc) => pc.close());
      pcRef.current.clear();
      failedRetryRef.current.clear();
      setRemotePeers(new Map());
      logger.info(MODULE, 'leave done');
    } catch (e) {
      logger.error(MODULE, 'leave failed', e);
    } finally {
      // refs cleared above
    }
  }, [localStream, screenStream]);

  return {
    localStream,
    screenStream,
    remotePeers: Array.from(remotePeers.values()),
    videoEnabled,
    audioEnabled,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    reconnectPeer,
    leave,
    displayName,
    handleSignalingMessage,
  };
}
