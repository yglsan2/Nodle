import { useCallback, useEffect, useRef, useState } from 'react';
import type { SignalingMessage } from './useSignaling';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

export type RemotePeer = {
  peerId: string;
  displayName?: string;
  video: boolean;
  audio: boolean;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
};

type UseWebRTCOptions = {
  roomId: string;
  localPeerId: string;
  displayName: string;
  signalingSend: (msg: Partial<SignalingMessage>) => void;
  onPeersList?: (peerIds: string[]) => void;
};

export function useWebRTC({
  roomId,
  localPeerId,
  displayName,
  signalingSend,
  onPeersList,
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const pcRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const knownPeersRef = useRef<Set<string>>(new Set());

  const addRemotePeer = useCallback((peerId: string, updater: (p: RemotePeer) => RemotePeer) => {
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
  }, []);

  const getOrCreatePC = useCallback((peerId: string): RTCPeerConnection => {
    let pc = pcRef.current.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current.set(peerId, pc);
    knownPeersRef.current.add(peerId);
    onPeersList?.(Array.from(knownPeersRef.current));

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      if (e.track.kind === 'video' && e.transceiver?.mid?.startsWith('screen')) {
        addRemotePeer(peerId, (p) => ({ ...p, screenStream: stream }));
      } else {
        addRemotePeer(peerId, (p) => ({ ...p, stream }));
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) signalingSend({ type: 'ice', toPeerId: peerId, payload: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed') {
        addRemotePeer(peerId, () => ({
          peerId,
          video: false,
          audio: false,
          stream: null,
          screenStream: null,
        }));
      }
    };

    return pc;
  }, [signalingSend, addRemotePeer, onPeersList]);

  const createOffer = useCallback(async (peerId: string) => {
    const pc = getOrCreatePC(peerId);
    localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
    if (screenStream) {
      screenStream.getTracks().forEach((t) => pc.addTrack(t, screenStream));
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signalingSend({ type: 'offer', toPeerId: peerId, payload: offer });
  }, [localStream, screenStream, getOrCreatePC, signalingSend]);

  const handleOffer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    const pc = getOrCreatePC(from);
    localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
    if (screenStream) screenStream.getTracks().forEach((t) => pc.addTrack(t, screenStream));
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    signalingSend({ type: 'answer', toPeerId: from, payload: answer });
  }, [localStream, screenStream, getOrCreatePC, signalingSend]);

  const handleAnswer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    const pc = pcRef.current.get(from);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const pending = pendingCandidatesRef.current.get(from) ?? [];
    for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c));
    pendingCandidatesRef.current.delete(from);
  }, []);

  const handleIce = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
    let pc = pcRef.current.get(from);
    if (!pc) {
      pc = getOrCreatePC(from);
      (pendingCandidatesRef.current.get(from) ?? []).push(candidate);
      const list = pendingCandidatesRef.current.get(from) ?? [];
      pendingCandidatesRef.current.set(from, [...list, candidate]);
      return;
    }
    if (pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      const pending = pendingCandidatesRef.current.get(from) ?? [];
      pending.push(candidate);
      pendingCandidatesRef.current.set(from, pending);
    }
  }, [getOrCreatePC]);

  const handleSignalingMessage = useCallback((msg: SignalingMessage) => {
    if (msg.fromPeerId === localPeerId) return;
    const from = msg.fromPeerId ?? '';
    const payload = msg.payload as RTCSessionDescriptionInit | RTCIceCandidateInit | undefined;

    switch (msg.type) {
      case 'join':
        createOffer(from);
        break;
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
  }, [localPeerId, createOffer, handleOffer, handleAnswer, handleIce]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
      } catch {
        setLocalStream(null);
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => { t.enabled = videoEnabled; });
    localStream.getAudioTracks().forEach((t) => { t.enabled = audioEnabled; });
  }, [localStream, videoEnabled, audioEnabled]);

  const toggleVideo = useCallback(() => setVideoEnabled((v) => !v), []);
  const toggleAudio = useCallback(() => setAudioEnabled((a) => !a), []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      setScreenStream(stream);
      stream.getVideoTracks()[0].onended = () => setScreenStream(null);
      pcRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video' && s.track.id !== localStream?.getVideoTracks()[0]?.id);
        if (sender) sender.replaceTrack(stream.getVideoTracks()[0]);
        else pc.addTrack(stream.getVideoTracks()[0], stream);
      });
    } catch {
      setScreenStream(null);
    }
  }, [localStream]);

  const stopScreenShare = useCallback(() => {
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    if (localStream) {
      pcRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        senders.forEach((s) => {
          if (s.track?.kind === 'video' && s.track.id !== localStream.getVideoTracks()[0]?.id) {
            pc.removeTrack(s);
          }
        });
        pc.addTrack(localStream.getVideoTracks()[0], localStream);
      });
    }
  }, [screenStream, localStream]);

  const leave = useCallback(() => {
    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    pcRef.current.forEach((pc) => pc.close());
    pcRef.current.clear();
    setRemotePeers(new Map());
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
    leave,
    displayName,
    handleSignalingMessage,
  };
}
