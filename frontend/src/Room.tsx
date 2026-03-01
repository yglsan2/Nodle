/**
 * Composant principal de la salle de visioconférence Nodle.
 * Réglages niveau Teams/Zoom, optimisé (memo, lazy), ergonomique et moderne.
 * @module Room
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useServerConfig } from './serverConfig';
import { useSignaling } from './useSignaling';
import { useWebRTC } from './useWebRTC';
import { useSettings } from './settings';
import type { SignalingMessage } from './useSignaling';
import type { ChatMessage, RoomRole } from './types';
import type { WhiteboardStroke, PlacedDoc } from './types';
import { Chat } from './Chat';
import { logger } from './logger';
import { Confetti } from './fun/Confetti';
import { PollForm } from './fun/PollForm';
import { QuickPoll, type PollData } from './fun/QuickPoll';
import { WelcomeToast, ReactionToast } from './fun/Toasts';

const WEATHER_OPTIONS = [
  { value: 'sunny', label: '☀️', title: 'Tout va bien' },
  { value: 'cloudy', label: '🌤️', title: 'Un peu dans le brouillard' },
  { value: 'stormy', label: '🌧️', title: 'Je suis perdu' },
  { value: 'unknown', label: '❓', title: 'Pas sûr' },
] as const;

const FRAME_OPTIONS = [
  { value: '', label: 'Aucun' },
  { value: '🎓', label: '🎓', title: 'Graduation' },
  { value: '⭐', label: '⭐', title: 'Star' },
  { value: '📚', label: '📚', title: 'Book' },
  { value: '🚀', label: '🚀', title: 'Rocket' },
  { value: '❤️', label: '❤️', title: 'Heart' },
  { value: '🔥', label: '🔥', title: 'Fire' },
] as const;

const Whiteboard = lazy(() => import('./Whiteboard').then((m) => ({ default: m.Whiteboard })));
const DocBoard = lazy(() => import('./DocBoard').then((m) => ({ default: m.DocBoard })));
const SharedFiles = lazy(() => import('./SharedFiles').then((m) => ({ default: m.SharedFiles })));
const SettingsPanel = lazy(() => import('./settings').then((m) => ({ default: m.SettingsPanel })));

const MODULE = 'Room';

type Tab = 'chat' | 'whiteboard' | 'files' | 'tableau' | 'participants';

type TypingPeer = { peerId: string; displayName: string };

type Props = {
  roomId: string;
  displayName: string;
  role?: RoomRole;
  onLeave: () => void;
};

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type AppConfig = {
  iceServers?: RTCIceServer[];
  sfuWsUrl?: string;
  signalingWsUrl?: string;
  signalingUrls?: string[];
};

export function Room({ roomId, displayName, role = 'participant', onLeave }: Props) {
  const peerId = useMemo(() => 'peer-' + genId(), []);

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<WhiteboardStroke[]>([]);
  const [placedDocs, setPlacedDocs] = useState<PlacedDoc[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [reactions, setReactions] = useState<Map<string, { emoji: string; until: number }>>(new Map());
  const [handsRaised, setHandsRaised] = useState<Map<string, boolean>>(new Map());
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [typingPeers, setTypingPeers] = useState<TypingPeer[]>([]);
  const lastReadChatAtRef = useRef<number>(Date.now());
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [weatherByPeer, setWeatherByPeer] = useState<Map<string, string>>(new Map());
  const [myWeather, setMyWeather] = useState<string>('unknown');
  const [frameByPeer, setFrameByPeer] = useState<Map<string, string>>(new Map());
  const [myFrame, setMyFrame] = useState<string>('');
  const [welcomeToast, setWelcomeToast] = useState<{ name: string } | null>(null);
  const [reactionToast, setReactionToast] = useState<{ emoji: string; displayName: string } | null>(null);
  const [activePoll, setActivePoll] = useState<PollData | null>(null);
  const [showPollForm, setShowPollForm] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [roomLockedReason, setRoomLockedReason] = useState<string | null>(null);
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [hostPeerId, setHostPeerId] = useState<string | null>(null);
  const [controllerPeerId, setControllerPeerId] = useState<string | null>(null);
  const [roomLocked, setRoomLocked] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockPasswordInput, setLockPasswordInput] = useState('');
  const [youWereKicked, setYouWereKicked] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [sharedTimerEnd, setSharedTimerEnd] = useState<number | null>(null);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [handsRaisedOrder, setHandsRaisedOrder] = useState<string[]>([]);
  const pttDidUnmuteRef = useRef(false);
  const welcomedPeersRef = useRef<Set<string>>(new Set());
  const peerDisplayNamesRef = useRef<Map<string, string>>(new Map());

  const { apiBase } = useServerConfig();
  const { settings, update: updateSettings } = useSettings();
  const urlSignalingParam = useMemo(() => new URLSearchParams(window.location.search).get('signaling'), []);

  const loadConfig = useCallback(() => {
    try {
      setConfigError(null);
      logger.info(MODULE, 'loadConfig start', apiBase);
      fetch(`${apiBase}/config`)
        .then((r) => {
          try {
            return r.ok ? r.json() : Promise.reject(new Error('Config invalide'));
          } catch (e) {
            logger.warn(MODULE, 'loadConfig json reject', e);
            return Promise.reject(e);
          } finally {
            // no cleanup
          }
        })
        .then((data: Record<string, unknown>) => {
          try {
            setConfig({
              iceServers: data.iceServers as AppConfig['iceServers'],
              sfuWsUrl: data.sfuWsUrl as string | undefined,
              signalingWsUrl: urlSignalingParam || (data.signalingWsUrl as string) || '',
              signalingUrls: Array.isArray(data.signalingUrls) ? data.signalingUrls as string[] : undefined,
            });
            logger.info(MODULE, 'loadConfig ok');
          } catch (e) {
            logger.warn(MODULE, 'loadConfig setState', e);
          } finally {
            // no cleanup
          }
        })
        .catch((err) => {
          try {
            setConfig({ signalingWsUrl: urlSignalingParam || '', signalingUrls: urlSignalingParam ? [urlSignalingParam] : [] });
            setConfigError(err?.message || 'Impossible de charger la configuration. Le mode relais sera utilisé.');
            logger.warn(MODULE, 'loadConfig fallback', err);
          } catch (e) {
            logger.error(MODULE, 'loadConfig catch failed', e);
          } finally {
            // no cleanup
          }
        });
    } catch (e) {
      logger.error(MODULE, 'loadConfig failed', e);
      setConfigError('Erreur lors du chargement de la configuration.');
    } finally {
      // no cleanup
    }
  }, [apiBase, urlSignalingParam]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const dispatchRef = useRef<(msg: SignalingMessage) => void>(() => {});

  const signalingUrls = useMemo(() => {
    const param = urlSignalingParam;
    if (param) return [param, '']; // relais d'abord, puis serveur (hybride)
    const urls = config?.signalingUrls;
    if (Array.isArray(urls) && urls.length > 0) return urls;
    const single = config?.signalingWsUrl;
    if (single) return [single, ''];
    return [];
  }, [config?.signalingUrls, config?.signalingWsUrl, urlSignalingParam]);

  const { connected, connectionError, connectionMode, send: signalingSend } = useSignaling({
    roomId,
    peerId,
    displayName,
    role,
    wsUrls: signalingUrls.length > 0 ? signalingUrls : undefined,
    onMessage: (msg) => dispatchRef.current(msg),
  });

  const iceServers = config?.iceServers?.length ? config.iceServers : undefined;
  const mediaSettings = useMemo(
    () => (settings ? { video: settings.video, audio: settings.audio } : undefined),
    [settings]
  );
  const webRTC = useWebRTC({
    roomId,
    localPeerId: peerId,
    displayName,
    signalingSend,
    iceServers,
    mediaSettings,
    initialVideoEnabled: !settings?.appearance?.joinWithVideoOff,
  });

  const handleSignalMessage = useCallback((msg: SignalingMessage) => {
    try {
      if (msg.type === 'joinRejected' && msg.payload) {
        const p = msg.payload as { reason?: string };
        setRoomLockedReason(p.reason ?? 'password_required');
        return;
      }
      if (msg.type === 'peersInRoom' && msg.payload) {
        setRoomLockedReason(null);
        const p = msg.payload as { hostPeerId?: string; controllerPeerId?: string | null };
        if (p.hostPeerId) setHostPeerId(p.hostPeerId);
        setControllerPeerId(p.controllerPeerId ?? null);
        webRTC.handleSignalingMessage(msg);
        return;
      }
      if (msg.type === 'controllerChange' && msg.payload) {
        const p = msg.payload as { controllerPeerId?: string | null };
        setControllerPeerId(p.controllerPeerId ?? null);
        return;
      }
      if (msg.type === 'join' && msg.payload && typeof msg.payload === 'object' && 'hostPeerId' in msg.payload) {
        const p = msg.payload as { hostPeerId?: string };
        if (p.hostPeerId) setHostPeerId(p.hostPeerId);
      }
      if (msg.type === 'kicked') {
        setYouWereKicked(true);
        return;
      }
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
          toPeerId: p.toPeerId as string | undefined,
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
    if (msg.type === 'docBoardAdd' && msg.payload) {
      const p = msg.payload as { doc?: PlacedDoc };
      if (p.doc) setPlacedDocs((prev) => [...prev, p.doc!]);
    }
    if (msg.type === 'docBoardUpdate' && msg.payload) {
      const p = msg.payload as { id?: string; patch?: Partial<PlacedDoc> };
      if (p.id && p.patch)
        setPlacedDocs((prev) =>
          prev.map((d) => (d.id === p.id ? { ...d, ...p.patch } : d))
        );
    }
    if (msg.type === 'docBoardRemove' && msg.payload) {
      const p = msg.payload as { id?: string };
      if (p.id) setPlacedDocs((prev) => prev.filter((d) => d.id !== p.id));
    }
    if (msg.type === 'docBoardVisibility' && msg.payload) {
      const p = msg.payload as { id?: string; visible?: boolean };
      if (p.id != null && p.visible !== undefined)
        setPlacedDocs((prev) =>
          prev.map((d) => (d.id === p.id ? { ...d, visible: p.visible! } : d))
        );
    }
    if (msg.type === 'reaction' && msg.payload && msg.fromPeerId) {
      const p = msg.payload as { emoji?: string };
      const emoji = (p.emoji ?? '👍').slice(0, 2);
      setReactions((prev) => {
        const next = new Map(prev);
        next.set(msg.fromPeerId!, { emoji, until: Date.now() + 3000 });
        return next;
      });
      const fromName = peerDisplayNamesRef.current.get(msg.fromPeerId!) ?? msg.fromPeerId?.slice(0, 8) ?? 'Quelqu\'un';
      setReactionToast({ emoji, displayName: fromName });
      if (emoji.includes('🎉') || emoji === '🎉') setShowConfetti(true);
    }
    if (msg.type === 'weather' && msg.payload && msg.fromPeerId) {
      const p = msg.payload as { mood?: string };
      const mood = p.mood ?? 'unknown';
      setWeatherByPeer((prev) => {
        const next = new Map(prev);
        next.set(msg.fromPeerId!, mood);
        return next;
      });
    }
    if (msg.type === 'frame' && msg.payload && msg.fromPeerId) {
      const p = msg.payload as { frame?: string };
      setFrameByPeer((prev) => {
        const next = new Map(prev);
        next.set(msg.fromPeerId!, p.frame ?? '');
        return next;
      });
    }
    if (msg.type === 'pollStart' && msg.payload) {
      const p = msg.payload as { id?: string; question?: string; options?: string[] };
      setActivePoll({
        id: p.id ?? genId(),
        question: p.question ?? 'Question ?',
        options: Array.isArray(p.options) ? p.options : ['Oui', 'Non'],
        votes: {},
      });
    }
    if (msg.type === 'pollVote' && msg.payload && msg.fromPeerId) {
      const p = msg.payload as { optionIndex?: number };
      const idx = typeof p.optionIndex === 'number' ? p.optionIndex : 0;
      setActivePoll((prev) => {
        if (!prev) return prev;
        const next = { ...prev, votes: { ...prev.votes, [msg.fromPeerId!]: idx } };
        return next;
      });
    }
    if (msg.type === 'join' && msg.fromPeerId && msg.fromPeerId !== peerId) {
      const p = msg.payload as { displayName?: string } | undefined;
      const name = p?.displayName ?? msg.fromPeerId.slice(0, 8);
      peerDisplayNamesRef.current.set(msg.fromPeerId, name);
      if (!welcomedPeersRef.current.has(msg.fromPeerId)) {
        welcomedPeersRef.current.add(msg.fromPeerId);
        setWelcomeToast({ name });
      }
    }
    if (msg.type === 'handRaised' && msg.fromPeerId !== undefined) {
      const p = msg.payload as { raised?: boolean };
      const raised = p?.raised ?? true;
      const pid = msg.fromPeerId!;
      setHandsRaised((prev) => {
        const next = new Map(prev);
        if (raised) next.set(pid, true);
        else next.delete(pid);
        return next;
      });
      setHandsRaisedOrder((prev) => {
        if (raised) return prev.includes(pid) ? prev : [...prev, pid];
        return prev.filter((id) => id !== pid);
      });
    }
    if (msg.type === 'timerStart' && msg.payload) {
      const p = msg.payload as { endTime?: number };
      if (typeof p.endTime === 'number') setSharedTimerEnd(p.endTime);
    }
    if (msg.type === 'typing' && msg.fromPeerId && msg.fromPeerId !== peerId) {
      const p = msg.payload as { displayName?: string; active?: boolean };
      const active = p?.active ?? true;
      setTypingPeers((prev) => {
        if (!active) return prev.filter((t) => t.peerId !== msg.fromPeerId);
        const name = (p.displayName as string) || msg.fromPeerId.slice(0, 8);
        return [...prev.filter((t) => t.peerId !== msg.fromPeerId), { peerId: msg.fromPeerId, displayName: name }];
      });
    }
    if (msg.type === 'chatHistory' && msg.payload) {
      const p = msg.payload as { messages?: unknown[] };
      const list = Array.isArray(p.messages) ? p.messages : [];
      const parsed: ChatMessage[] = list.map((m: Record<string, unknown>) => ({
        id: (m.id as string) || genId(),
        fromPeerId: (m.fromPeerId as string) || '',
        displayName: (m.displayName as string) || 'Anonyme',
        at: (m.at as number) || Date.now(),
        text: m.text as string | undefined,
        gifUrl: m.gifUrl as string | undefined,
        attachment: m.attachment as ChatMessage['attachment'],
        codeBlock: m.codeBlock as ChatMessage['codeBlock'],
        toPeerId: m.toPeerId as string | undefined,
      }));
      setChatMessages((prev) => {
        const byId = new Map(prev.map((x) => [x.id, x]));
        parsed.forEach((x) => byId.set(x.id, x));
        return Array.from(byId.values()).sort((a, b) => a.at - b.at);
      });
      return;
    }
  } catch (e) {
    logger.warn(MODULE, 'handleSignalMessage failed', msg?.type, e);
  } finally {
    // no cleanup
  }
  }, [peerId]);

  useEffect(() => {
    dispatchRef.current = (msg: SignalingMessage) => {
      try {
        handleSignalMessage(msg);
        if (msg.type !== 'peersInRoom') webRTC.handleSignalingMessage(msg);
      } catch (e) {
        logger.warn(MODULE, 'dispatch message failed', msg?.type, e);
      } finally {
        // no cleanup
      }
    };
  }, [handleSignalMessage, webRTC.handleSignalingMessage]);

  useEffect(() => {
    if (!youWereKicked) return;
    webRTC.leave();
    onLeave();
  }, [youWereKicked, webRTC, onLeave]);

  // Hôte : récupérer l'état verrouillé de la salle (backend uniquement)
  useEffect(() => {
    if (hostPeerId !== peerId) return;
    fetch(`${apiBase}/rooms/${roomId}/state`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { locked?: boolean } | null) => { if (data && typeof data.locked === 'boolean') setRoomLocked(data.locked); })
      .catch(() => {});
  }, [apiBase, roomId, hostPeerId, peerId]);

  // Chrono partagé : countdown et fin
  useEffect(() => {
    if (sharedTimerEnd == null) return;
    const tick = () => {
      if (Date.now() >= sharedTimerEnd!) {
        setSharedTimerEnd(null);
        setReactionToast({ emoji: '⏱️', displayName: 'Temps écoulé !' });
      }
    };
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [sharedTimerEnd]);

  const startTimer = useCallback((durationMs: number) => {
    const endTime = Date.now() + durationMs;
    signalingSend({ type: 'timerStart', payload: { endTime } });
    setSharedTimerEnd(endTime);
    setShowTimerModal(false);
  }, [signalingSend]);

  // Envoyer le statut micro/caméra aux autres dès qu'on est connecté et à chaque changement
  useEffect(() => {
    if (!connected || !signalingSend) return;
    signalingSend({ type: 'muteState', payload: { video: webRTC.videoEnabled, audio: webRTC.audioEnabled } });
  }, [connected, webRTC.videoEnabled, webRTC.audioEnabled, signalingSend]);

  const setWeather = useCallback(
    (mood: string) => {
      setMyWeather(mood);
      signalingSend({ type: 'weather', payload: { mood } });
    },
    [signalingSend]
  );

  const setFrame = useCallback(
    (frame: string) => {
      setMyFrame(frame);
      signalingSend({ type: 'frame', payload: { frame } });
    },
    [signalingSend]
  );

  useEffect(() => {
    if (!connected || !signalingSend) return;
    signalingSend({ type: 'weather', payload: { mood: myWeather } });
    if (myFrame) signalingSend({ type: 'frame', payload: { frame: myFrame } });
  }, [connected]);

  const startPoll = useCallback(
    (question: string, options: string[]) => {
      const id = genId();
      signalingSend({ type: 'pollStart', payload: { id, question, options } });
      setActivePoll({ id, question, options, votes: {} });
      setShowPollForm(false);
    },
    [signalingSend]
  );

  const votePoll = useCallback(
    (optionIndex: number) => {
      if (!activePoll) return;
      signalingSend({ type: 'pollVote', payload: { optionIndex } });
      setActivePoll((prev) => (prev ? { ...prev, votes: { ...prev.votes, [peerId]: optionIndex } } : null));
    },
    [activePoll, peerId, signalingSend]
  );

  const onTyping = useCallback(
    (active: boolean) => {
      signalingSend({ type: 'typing', payload: { displayName, active } });
      if (!active) setTypingPeers((prev) => prev.filter((t) => t.peerId !== peerId));
    },
    [displayName, peerId, signalingSend]
  );

  // Badge non lu : compter les messages reçus depuis la dernière visite de l'onglet chat
  useEffect(() => {
    if (activeTab === 'chat') {
      lastReadChatAtRef.current = Date.now();
      setUnreadChatCount(0);
    } else {
      const lastRead = lastReadChatAtRef.current;
      const count = chatMessages.filter((m) => m.at > lastRead && m.fromPeerId !== peerId).length;
      setUnreadChatCount(count);
    }
  }, [activeTab, chatMessages, peerId]);

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
          toPeerId: msg.toPeerId,
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

  const sendDocBoardAdd = useCallback(
    (doc: PlacedDoc) => {
      setPlacedDocs((prev) => [...prev, doc]);
      signalingSend({ type: 'docBoardAdd', payload: { doc } });
    },
    [signalingSend]
  );

  const sendDocBoardUpdate = useCallback(
    (id: string, patch: Partial<PlacedDoc>) => {
      setPlacedDocs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
      );
      signalingSend({ type: 'docBoardUpdate', payload: { id, patch } });
    },
    [signalingSend]
  );

  const sendDocBoardRemove = useCallback(
    (id: string) => {
      setPlacedDocs((prev) => prev.filter((d) => d.id !== id));
      signalingSend({ type: 'docBoardRemove', payload: { id } });
    },
    [signalingSend]
  );

  const sendDocBoardVisibility = useCallback(
    (id: string, visible: boolean) => {
      setPlacedDocs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, visible } : d))
      );
      signalingSend({ type: 'docBoardVisibility', payload: { id, visible } });
    },
    [signalingSend]
  );

  const handleAddFileToBoard = useCallback(
    (file: { id: string; name: string; url: string; contentType: string }) => {
      const doc: PlacedDoc = {
        id: genId(),
        fileId: file.id,
        name: file.name,
        url: file.url,
        contentType: file.contentType,
        x: 20 + placedDocs.length * 30,
        y: 20 + placedDocs.length * 30,
        width: 280,
        height: 200,
        rotation: 0,
        visible: true,
        createdBy: peerId,
      };
      sendDocBoardAdd(doc);
      setActiveTab('tableau');
    },
    [placedDocs.length, peerId, sendDocBoardAdd]
  );

  const sendTakeControl = useCallback(() => {
    signalingSend({ type: 'takeControl', payload: {} });
  }, [signalingSend]);

  const sendDelegateControl = useCallback(
    (targetPeerId: string) => {
      signalingSend({ type: 'delegateControl', payload: { targetPeerId } });
    },
    [signalingSend]
  );

  const otherTeachers = useMemo(
    () => webRTC.remotePeers.filter((p) => p.role === 'teacher'),
    [webRTC.remotePeers]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      signalingSend({ type: 'reaction', payload: { emoji } });
      setReactions((prev) => {
        const next = new Map(prev);
        next.set(peerId, { emoji: emoji.slice(0, 2), until: Date.now() + 3000 });
        return next;
      });
    },
    [peerId, signalingSend]
  );

  const toggleHandRaised = useCallback(() => {
    const next = !myHandRaised;
    setMyHandRaised(next);
    signalingSend({ type: 'handRaised', payload: { raised: next } });
    setHandsRaised((prev) => {
      const m = new Map(prev);
      if (next) m.set(peerId, true);
      else m.delete(peerId);
      return m;
    });
    setHandsRaisedOrder((prev) => {
      if (next) return prev.includes(peerId) ? prev : [...prev, peerId];
      return prev.filter((id) => id !== peerId);
    });
  }, [myHandRaised, peerId, signalingSend]);

  // Raccourcis clavier : M micro, V caméra, S partage écran, H lever la main, Espace = push-to-talk
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      const pushToTalk = settings?.audioBehavior?.pushToTalk ?? false;
      if (pushToTalk && key === ' ') {
        e.preventDefault();
        if (!webRTC.audioEnabled) {
          webRTC.toggleAudio();
          pttDidUnmuteRef.current = true;
        }
        return;
      }
      if (key === 'm') {
        e.preventDefault();
        webRTC.toggleAudio();
      } else if (key === 'v') {
        e.preventDefault();
        webRTC.toggleVideo();
      } else if (key === 's') {
        e.preventDefault();
        if (webRTC.screenStream) webRTC.stopScreenShare();
        else webRTC.startScreenShare();
      } else if (key === 'h') {
        e.preventDefault();
        toggleHandRaised();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((settings?.audioBehavior?.pushToTalk ?? false) && e.key.toLowerCase() === ' ') {
        e.preventDefault();
        if (pttDidUnmuteRef.current) {
          webRTC.toggleAudio();
          pttDidUnmuteRef.current = false;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [webRTC, toggleHandRaised, settings?.audioBehavior?.pushToTalk]);

  // Nettoyer les réactions expirées
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setReactions((prev) => {
        let changed = false;
        const next = new Map(prev);
        next.forEach((v, k) => {
          if (v.until <= now) {
            next.delete(k);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(t);
  }, []);

  const leave = useCallback(() => {
    try {
      logger.info(MODULE, 'leave');
      webRTC.leave();
      setShowLeaveConfirm(false);
      onLeave();
    } catch (e) {
      logger.error(MODULE, 'leave failed', e);
      onLeave();
    } finally {
      // no cleanup
    }
  }, [webRTC, onLeave]);

  const apiBaseFiles = useMemo(() => `${apiBase}/rooms/${roomId}/files`, [apiBase, roomId]);
  const fileOrigin = useMemo(
    () => (apiBaseFiles.startsWith('http') ? new URL(apiBaseFiles).origin : window.location.origin),
    [apiBaseFiles]
  );

  const layout = settings?.appearance?.layout ?? 'speaker';
  const remotePeers = webRTC.remotePeers;
  const mainRemote = useMemo(() => {
    if (layout === 'grid') return null;
    if (pinnedPeerId) {
      const pinned = remotePeers.find((p) => p.peerId === pinnedPeerId);
      if (pinned) return pinned;
    }
    const withScreen = remotePeers.find((p) => p.screenStream);
    if (withScreen) return withScreen;
    const teacher = remotePeers.find((p) => p.role === 'teacher');
    if (teacher) return teacher;
    return remotePeers[0] ?? null;
  }, [remotePeers, layout, pinnedPeerId]);
  const gridRemotes = mainRemote ? remotePeers.filter((p) => p.peerId !== mainRemote.peerId) : remotePeers;
  const togglePin = useCallback((peerId: string) => {
    setPinnedPeerId((prev) => (prev === peerId ? null : peerId));
  }, []);

  const copyRoomLink = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }).catch(() => {});
  }, []);

  const submitRoomPassword = useCallback(() => {
    signalingSend({ type: 'join', payload: { displayName, role, password: roomPasswordInput } });
  }, [signalingSend, displayName, role, roomPasswordInput]);

  const submitLockRoom = useCallback(() => {
    if (!lockPasswordInput.trim()) return;
    fetch(`${apiBase}/rooms/${roomId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: lockPasswordInput }),
    }).then((r) => { if (r.ok) { setRoomLocked(true); setShowLockModal(false); setLockPasswordInput(''); } }).catch(() => {});
  }, [apiBase, roomId, lockPasswordInput]);

  const unlockRoom = useCallback(() => {
    fetch(`${apiBase}/rooms/${roomId}/lock`, { method: 'DELETE' })
      .then((r) => { if (r.ok) setRoomLocked(false); }).catch(() => {});
  }, [apiBase, roomId]);
  const totalParticipants = 1 + remotePeers.length;
  const sidebarCollapsed = settings?.appearance?.sidebarCollapsed ?? false;

  const weatherSummary = useMemo(() => {
    const map = new Map(weatherByPeer);
    map.set(peerId, myWeather);
    const sun = [...map.values()].filter((m) => m === 'sunny').length;
    const cloud = [...map.values()].filter((m) => m === 'cloudy').length;
    const storm = [...map.values()].filter((m) => m === 'stormy').length;
    const unknown = [...map.values()].filter((m) => m === 'unknown' || !m).length;
    return { sun, cloud, storm, unknown, total: map.size };
  }, [weatherByPeer, peerId, myWeather]);

  return (
    <div style={styles.layout}>
      <header style={styles.header}>
        <h1 style={styles.title}>
          Nodle · {roomId}
          {(role === 'teacher' || role === 'student') && (
            <span style={role === 'teacher' ? styles.roleTeacher : styles.roleStudent}>
              {role === 'teacher' ? ' 👩‍🏫 Prof' : ' 👤 Élève'}
            </span>
          )}
        </h1>
        {connected && (
          <>
            <span style={styles.p2pBadge} title="Flux vidéo/audio en P2P entre participants">
              🔗 P2P
            </span>
            <span style={connectionMode === 'relay' ? styles.modeRelay : styles.modeServer} title={connectionMode === 'relay' ? 'Signaling via relais (partage d\'espace)' : 'Signaling via serveur'}>
              {connectionMode === 'relay' ? '📡 Relais' : '🖥️ Serveur'}
            </span>
            {settings?.network?.contributeToRelay !== false && !settings?.network?.ecoMode && (
              <span style={styles.contributionBadge} title="Vous contribuez à la stabilité du réseau">
                🌐 Contribution
              </span>
            )}
          </>
        )}
        <span style={styles.badge}>
          {connected
            ? `Connecté · ${totalParticipants} participant${totalParticipants > 1 ? 's' : ''}`
            : connectionError?.includes('Reconnexion')
              ? 'Reconnexion…'
              : 'Connexion…'}
        </span>
        <button
          type="button"
          onClick={copyRoomLink}
          style={styles.copyLinkBtn}
          title="Copier le lien d’invitation pour partager la salle"
        >
          {linkCopied ? '✓ Lien copié' : '📋 Copier le lien'}
        </button>
        {connected && weatherSummary.total > 0 && (
          <span style={styles.weatherSummary} title="Météo du cours : comment la classe se sent">
            ☀️ {weatherSummary.sun}  🌤️ {weatherSummary.cloud}  🌧️ {weatherSummary.storm}
            {weatherSummary.unknown > 0 ? `  ❓ ${weatherSummary.unknown}` : ''}
          </span>
        )}
        {connectionError && (
          <span style={styles.errorBadge} title={connectionError}>
            {connectionError.length > 55 ? connectionError.slice(0, 52) + '…' : connectionError}
          </span>
        )}
        {configError && (
          <span style={styles.errorBadge} title={configError}>
            {configError.length > 40 ? configError.slice(0, 37) + '…' : configError}
          </span>
        )}
        {configError && (
          <button type="button" onClick={loadConfig} style={styles.retryBtn}>
            Réessayer la config
          </button>
        )}
        {hostPeerId === peerId && (
          <>
            {roomLocked ? (
              <button type="button" onClick={unlockRoom} style={styles.lockBtn} title="Déverrouiller la salle">
                🔓 Déverrouiller
              </button>
            ) : (
              <button type="button" onClick={() => setShowLockModal(true)} style={styles.lockBtn} title="Verrouiller la salle avec un mot de passe">
                🔒 Verrouiller
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          style={styles.settingsBtn}
          title="Réglages (vidéo, audio, apparence)"
          aria-label="Ouvrir les réglages"
        >
          ⚙️
        </button>
        <button type="button" onClick={() => setShowLeaveConfirm(true)} style={styles.leaveBtn} title="Quitter la réunion">
          Quitter
        </button>
      </header>

      {showLeaveConfirm && (
        <div style={styles.leaveOverlay} onClick={() => setShowLeaveConfirm(false)} role="dialog" aria-labelledby="leave-title">
          <div style={styles.leaveModal} onClick={(e) => e.stopPropagation()}>
            <h2 id="leave-title" style={styles.leaveTitle}>Quitter la réunion ?</h2>
            <p style={styles.leaveHint}>Vous devrez rejoindre à nouveau avec le lien pour revenir.</p>
            <div style={styles.leaveActions}>
              <button type="button" onClick={() => setShowLeaveConfirm(false)} style={styles.leaveCancel}>Annuler</button>
              <button type="button" onClick={leave} style={styles.leaveConfirm}>Quitter</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </Suspense>
      )}

      {roomLockedReason && (
        <div style={styles.lockOverlay}>
          <div style={styles.lockCard}>
            <h3 style={styles.lockTitle}>
              {roomLockedReason === 'wrong_password' ? 'Mot de passe incorrect' : 'Salle verrouillée'}
            </h3>
            <p style={styles.lockHint}>Entrez le mot de passe pour rejoindre.</p>
            <input
              type="password"
              value={roomPasswordInput}
              onChange={(e) => setRoomPasswordInput(e.target.value)}
              placeholder="Mot de passe"
              style={styles.lockInput}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submitRoomPassword())}
            />
            <button type="button" onClick={submitRoomPassword} style={styles.lockSubmit}>
              Rejoindre
            </button>
          </div>
        </div>
      )}

      {showLockModal && (
        <div style={styles.lockOverlay} onClick={() => setShowLockModal(false)}>
          <div style={styles.lockCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.lockTitle}>Verrouiller la salle</h3>
            <input
              type="password"
              value={lockPasswordInput}
              onChange={(e) => setLockPasswordInput(e.target.value)}
              placeholder="Choisir un mot de passe"
              style={styles.lockInput}
            />
            <div style={styles.lockActions}>
              <button type="button" onClick={() => setShowLockModal(false)} style={styles.lockCancel}>Annuler</button>
              <button type="button" onClick={submitLockRoom} style={styles.lockSubmit}>Verrouiller</button>
            </div>
          </div>
        </div>
      )}

      {welcomeToast && (
        <WelcomeToast name={welcomeToast.name} onDone={() => setWelcomeToast(null)} />
      )}
      {reactionToast && (
        <ReactionToast
          emoji={reactionToast.emoji}
          displayName={reactionToast.displayName}
          onDone={() => setReactionToast(null)}
        />
      )}
      <Confetti active={showConfetti} onDone={() => setShowConfetti(false)} />

      {showTimerModal && role === 'teacher' && (
        <div style={styles.timerOverlay} onClick={() => setShowTimerModal(false)}>
          <div style={styles.timerModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.timerTitle}>Chronomètre partagé</h3>
            <p style={styles.timerHint}>Toute la salle verra le décompte.</p>
            <div style={styles.timerButtons}>
              {[1, 2, 5, 10].map((min) => (
                <button key={min} type="button" onClick={() => startTimer(min * 60 * 1000)} style={styles.timerBtn}>
                  {min} min
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowTimerModal(false)} style={styles.timerCancel}>Annuler</button>
          </div>
        </div>
      )}

      {sharedTimerEnd != null && (
        <div style={styles.timerFloating}>
          <span style={styles.timerLabel}>Chrono</span>
          <span style={styles.timerCount}>
            {(() => {
              const left = Math.max(0, Math.ceil((sharedTimerEnd - Date.now()) / 1000));
              const m = Math.floor(left / 60);
              const s = left % 60;
              return `${m}:${s.toString().padStart(2, '0')}`;
            })()}
          </span>
        </div>
      )}

      {activePoll && (
        <QuickPoll
          poll={activePoll}
          myPeerId={peerId}
          onVote={votePoll}
          onClose={() => setActivePoll(null)}
          canClose={role === 'teacher'}
        />
      )}

      {showPollForm && role === 'teacher' && (
        <PollForm
          onStart={startPoll}
          onClose={() => setShowPollForm(false)}
        />
      )}

      {!webRTC.localStream && (
        <div style={styles.mediaBanner} role="alert">
          Autorisez le micro et la caméra pour participer à la visioconférence (icône cadenas ou paramètres du navigateur).
        </div>
      )}

      <div style={styles.main}>
        <section style={styles.videoSection}>
          <div style={styles.videoClassLayout}>
            {mainRemote && (
              <div style={styles.mainStage}>
                <span style={styles.mainStageLabel}>Intervenant principal</span>
                <RemoteVideo
                  peerId={mainRemote.peerId}
                  displayName={mainRemote.displayName}
                  video={mainRemote.video}
                  audio={mainRemote.audio}
                  stream={mainRemote.stream}
                  screenStream={mainRemote.screenStream}
                  reaction={reactions.get(mainRemote.peerId)?.emoji}
                  handRaised={handsRaised.get(mainRemote.peerId)}
                  role={mainRemote.role}
                  large
                  frame={frameByPeer.get(mainRemote.peerId) ?? ''}
                  connectionState={mainRemote.connectionState}
                  isPinned={pinnedPeerId === mainRemote.peerId}
                  isController={controllerPeerId === mainRemote.peerId}
                  onPin={() => togglePin(mainRemote.peerId)}
                  onReconnect={() => webRTC.reconnectPeer(mainRemote.peerId)}
                />
              </div>
            )}
            <div style={styles.videoGrid} role="list">
              <div style={styles.videoTileWrap}>
                <LocalVideo
                  stream={webRTC.localStream}
                  screenStream={webRTC.screenStream}
                  displayName={webRTC.displayName}
                  videoEnabled={webRTC.videoEnabled}
                  audioEnabled={webRTC.audioEnabled}
                  reaction={reactions.get(peerId)?.emoji}
                  handRaised={myHandRaised}
                  frame={myFrame}
                  isController={controllerPeerId === peerId}
                />
              </div>
              {gridRemotes.map((p) => (
                <div key={p.peerId} style={styles.videoTileWrap}>
                  <RemoteVideo
                    peerId={p.peerId}
                    displayName={p.displayName}
                    video={p.video}
                    audio={p.audio}
                    stream={p.stream}
                    screenStream={p.screenStream}
                    reaction={reactions.get(p.peerId)?.emoji}
                    handRaised={handsRaised.get(p.peerId)}
                    role={p.role}
                    frame={frameByPeer.get(p.peerId) ?? ''}
                    connectionState={p.connectionState}
                    isPinned={pinnedPeerId === p.peerId}
                    isController={controllerPeerId === p.peerId}
                    onPin={() => togglePin(p.peerId)}
                    onReconnect={() => webRTC.reconnectPeer(p.peerId)}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={styles.controls}>
            <div style={styles.controlGroup}>
              <button
                type="button"
                onClick={webRTC.toggleAudio}
                style={{
                  ...styles.controlBtn,
                  ...(webRTC.audioEnabled ? {} : styles.controlBtnOff),
                }}
                title="Micro (M) — Les autres ne vous entendent pas quand coupé"
              >
                <span style={styles.controlIcon}>{webRTC.audioEnabled ? '🎤' : '🔇'}</span>
                <span style={styles.controlLabel}>{webRTC.audioEnabled ? 'Couper le micro' : 'Micro coupé'}</span>
              </button>
              <button
                type="button"
                onClick={webRTC.toggleVideo}
                style={{
                  ...styles.controlBtn,
                  ...(webRTC.videoEnabled ? {} : styles.controlBtnOff),
                }}
                title="Caméra (V) — Les autres ne vous voient pas quand coupée"
              >
                <span style={styles.controlIcon}>{webRTC.videoEnabled ? '📹' : '📵'}</span>
                <span style={styles.controlLabel}>{webRTC.videoEnabled ? 'Couper la caméra' : 'Caméra coupée'}</span>
              </button>
              {webRTC.screenStream ? (
                <button type="button" onClick={webRTC.stopScreenShare} style={styles.controlBtn} title="Partage écran (S)">
                  <span style={styles.controlIcon}>🖥️</span>
                  <span style={styles.controlLabel}>Arrêter partage</span>
                </button>
              ) : (
                <button type="button" onClick={webRTC.startScreenShare} style={styles.controlBtn} title="Partage écran (S)">
                  <span style={styles.controlIcon}>🖥️</span>
                  <span style={styles.controlLabel}>Partager l'écran</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={toggleHandRaised}
              style={{
                ...styles.controlBtn,
                ...(myHandRaised ? styles.controlBtnHandRaised : {}),
              }}
                title="Lever la main (H)"
            >
              <span style={styles.controlIcon}>{myHandRaised ? '🙋' : '✋'}</span>
              <span style={styles.controlLabel}>{myHandRaised ? 'Baisser la main' : 'Lever la main'}</span>
            </button>
            <div style={styles.reactionBar}>
              {['👍', '👏', '❤️', '😂', '🔥', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  style={styles.reactionBtn}
                  title={emoji === '🎉' ? 'Célébration (confettis !)' : 'Réaction'}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div style={styles.weatherBar} title="Météo du cours : comment tu te sens ?">
              {WEATHER_OPTIONS.map(({ value, label, title }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWeather(value)}
                  style={{
                    ...styles.weatherBtn,
                    ...(myWeather === value ? styles.weatherBtnActive : {}),
                  }}
                  title={title}
                  aria-pressed={myWeather === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={styles.frameBar} title="Mon badge">
              <select
                value={myFrame}
                onChange={(e) => setFrame(e.target.value)}
                style={styles.frameSelect}
                aria-label="Choisir un badge"
              >
                {FRAME_OPTIONS.map(({ value, label }) => (
                  <option key={value || 'none'} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {role === 'teacher' && (
              <>
                {controllerPeerId !== peerId ? (
                  <button
                    type="button"
                    onClick={sendTakeControl}
                    style={styles.takeControlBtn}
                    title="Prendre les commandes de la session (pilote)"
                  >
                    🎛️ Prendre les commandes
                  </button>
                ) : (
                  <div style={styles.controllerWrap}>
                    <span style={styles.controllerBadge} title="Vous pilotez la session">🎛️ Pilote</span>
                    {otherTeachers.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id) {
                            sendDelegateControl(id);
                            e.target.value = '';
                          }
                        }}
                        style={styles.delegateSelect}
                        title="Déléguer à un autre enseignant"
                      >
                        <option value="">Déléguer à…</option>
                        {otherTeachers.map((p) => (
                          <option key={p.peerId} value={p.peerId}>
                            {p.displayName ?? p.peerId.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowPollForm(true)}
                  style={styles.pollBtn}
                  title="Lancer un vote rapide (quizz flash)"
                >
                  📊 Vote
                </button>
                <button
                  type="button"
                  onClick={() => setShowTimerModal(true)}
                  style={styles.pollBtn}
                  title="Lancer un chronomètre partagé"
                >
                  ⏱️ Chrono
                </button>
              </>
            )}
            <button type="button" onClick={() => setShowLeaveConfirm(true)} style={styles.leaveControlBtn} title="Quitter">
              <span style={styles.controlIcon}>📞</span>
              <span style={styles.controlLabel}>Raccrocher</span>
            </button>
            <p style={styles.shortcutsHint} title="Raccourcis clavier">
              Raccourcis : <kbd>M</kbd> micro · <kbd>V</kbd> caméra · <kbd>S</kbd> écran · <kbd>H</kbd> main
              {settings?.audioBehavior?.pushToTalk && <> · <kbd>Espace</kbd> parler</>}
            </p>
          </div>
        </section>

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => updateSettings({ appearance: { ...settings.appearance, sidebarCollapsed: false } })}
            style={styles.sidebarExpandBtn}
            title="Afficher le panneau (chat, participants, tableau, fichiers)"
            aria-label="Afficher le panneau"
          >
            ▶
          </button>
        )}
        <aside style={{ ...styles.sidebar, ...(sidebarCollapsed ? styles.sidebarCollapsed : {}) }}>
          <div style={styles.tabs}>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => updateSettings({ appearance: { ...settings.appearance, sidebarCollapsed: true } })}
                style={styles.sidebarCollapseBtn}
                title="Masquer le panneau"
                aria-label="Masquer le panneau"
              >
                ▶
              </button>
            )}
            {(['chat', 'participants', 'whiteboard', 'files', 'tableau'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  ...styles.tab,
                  ...(activeTab === tab ? styles.tabActive : {}),
                }}
              >
                {tab === 'chat' && (
                  <>
                    💬 Chat
                    {unreadChatCount > 0 && (
                      <span style={styles.unreadBadge}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>
                    )}
                  </>
                )}
                {tab === 'participants' && '👥 Participants'}
                {tab === 'whiteboard' && '✏️ Tableau blanc'}
                {tab === 'files' && '📁 Fichiers'}
                {tab === 'tableau' && '📋 Tableau docs'}
              </button>
            ))}
          </div>
          <div style={styles.panel}>
            {activeTab === 'chat' && (
              <Chat
                messages={chatMessages.filter((m) => !m.toPeerId || m.toPeerId === peerId || m.fromPeerId === peerId)}
                onSend={sendChatMessage}
                onTyping={onTyping}
                typingPeers={typingPeers.filter((t) => t.peerId !== peerId)}
                displayName={displayName}
                roomId={roomId}
                myPeerId={peerId}
                remotePeers={webRTC.remotePeers.map((p) => ({ peerId: p.peerId, displayName: p.displayName ?? p.peerId.slice(0, 8) }))}
              />
            )}
            {activeTab === 'whiteboard' && (
              <Suspense fallback={<div style={styles.panelFallback}>Chargement…</div>}>
              <Whiteboard
                strokes={whiteboardStrokes}
                onStroke={sendWhiteboardStroke}
                peerId={peerId}
              />
              </Suspense>
            )}
            {activeTab === 'participants' && (
              <div style={styles.participantsPanel}>
                {handsRaisedOrder.length > 0 && (
                  <div style={styles.handQueue}>
                    <span style={styles.handQueueTitle}>🙋 File d'attente</span>
                    {handsRaisedOrder.map((pid, i) => (
                      <div key={pid} style={styles.handQueueRow}>
                        <span style={styles.handQueueRank}>{i + 1}</span>
                        <span>{pid === peerId ? 'Vous' : (webRTC.remotePeers.find((p) => p.peerId === pid)?.displayName ?? pid.slice(0, 8))}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p style={styles.participantsHint}>
                  Liste des participants. Le formateur voit qui lève la main et dans quel ordre.
                </p>
                <div style={styles.participantRow}>
                  <span style={styles.participantName}>
                    Vous · {displayName}
                    {(role === 'teacher' || role === 'student') && (
                      <span style={role === 'teacher' ? styles.roleBadgeTeacher : styles.roleBadgeStudent}>
                        {role === 'teacher' ? ' Prof' : ' Élève'}
                      </span>
                    )}
                    {controllerPeerId === peerId && <span style={styles.pilotBadge}> · 🎛️ Pilote</span>}
                  </span>
                  <span style={styles.participantIcons}>
                    {webRTC.videoEnabled ? '📹' : '📵'} {webRTC.audioEnabled ? '🎤' : '🔇'}
                  </span>
                  {myHandRaised && <span style={styles.handRaisedBadge}>🙋 Main levée</span>}
                </div>
                {webRTC.remotePeers.map((p) => (
                  <div key={p.peerId} style={styles.participantRow}>
                    <span style={styles.participantName}>
                      {p.displayName ?? p.peerId.slice(0, 8)}
                      {(p.role === 'teacher' || p.role === 'student') && (
                        <span style={p.role === 'teacher' ? styles.roleBadgeTeacher : styles.roleBadgeStudent}>
                          {p.role === 'teacher' ? ' Prof' : ' Élève'}
                        </span>
                      )}
                      {controllerPeerId === p.peerId && <span style={styles.pilotBadge}> · 🎛️ Pilote</span>}
                    </span>
                    <span style={styles.participantIcons}>
                      {p.video ? '📹' : '📵'} {p.audio ? '🎤' : '🔇'}
                    </span>
                    {handsRaised.get(p.peerId) && (
                      <span style={styles.handRaisedBadge}>🙋 Main levée</span>
                    )}
                    {hostPeerId === peerId && (
                      <button
                        type="button"
                        onClick={() => signalingSend({ type: 'kick', payload: { peerId: p.peerId } })}
                        style={styles.kickBtn}
                        title="Expulser ce participant"
                      >
                        Expulser
                      </button>
                    )}
                  </div>
                ))}
                {webRTC.remotePeers.length === 0 && (
                  <p style={styles.participantsEmpty}>Aucun autre participant.</p>
                )}
              </div>
            )}
            {activeTab === 'files' && (
              <Suspense fallback={<div style={styles.panelFallback}>Chargement…</div>}>
                <SharedFiles
                  roomId={roomId}
                  apiBase={apiBaseFiles}
                  displayName={displayName}
                  onAddToBoard={handleAddFileToBoard}
                />
              </Suspense>
            )}
            {activeTab === 'tableau' && (
              <Suspense fallback={<div style={styles.panelFallback}>Chargement…</div>}>
                <DocBoard
                  placedDocs={placedDocs}
                  fileBaseUrl={fileOrigin}
                  myPeerId={peerId}
                  onUpdate={sendDocBoardUpdate}
                  onRemove={sendDocBoardRemove}
                  onToggleVisibility={sendDocBoardVisibility}
                />
              </Suspense>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

const LocalVideo = React.memo(function LocalVideo({
  stream,
  screenStream,
  displayName,
  videoEnabled,
  audioEnabled,
  reaction,
  handRaised,
  frame,
  isController,
}: {
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  displayName: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  reaction?: string;
  handRaised?: boolean;
  frame?: string;
  isController?: boolean;
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
          <div style={styles.videoPlaceholder}>
            <span style={styles.videoPlaceholderTitle}>Caméra coupée</span>
            <span style={styles.videoPlaceholderSub}>Les autres ne vous voient pas</span>
          </div>
        )}
        {!audioEnabled && (
          <div style={styles.mutedBanner}>
            <span style={styles.mutedBannerIcon}>🔇</span>
            <span>Micro coupé — les autres ne vous entendent pas</span>
          </div>
        )}
        {reaction && <span style={styles.reactionOverlay}>{reaction}</span>}
        {handRaised && <span style={styles.handRaisedOverlay}>🙋</span>}
        {frame && <span style={styles.frameBadge} title="Mon badge">{frame}</span>}
      </div>
      <span style={styles.videoLabel}>
        Vous · {displayName}
        {isController && <span style={styles.videoLabelRole}> · 🎛️ Pilote</span>}
      </span>
    </div>
  );
});

type PeerConnectionState = import('./useWebRTC').PeerConnectionState;

const RemoteVideo = React.memo(function RemoteVideo({
  peerId,
  displayName,
  video,
  audio,
  stream,
  screenStream,
  reaction,
  handRaised,
  role,
  large = false,
  frame = '',
  connectionState,
  isPinned,
  isController,
  onPin,
  onReconnect,
}: {
  peerId: string;
  displayName?: string;
  video?: boolean;
  audio?: boolean;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  reaction?: string;
  handRaised?: boolean;
  role?: 'teacher' | 'student' | 'participant';
  large?: boolean;
  frame?: string;
  connectionState?: PeerConnectionState;
  isPinned?: boolean;
  isController?: boolean;
  onPin?: () => void;
  onReconnect?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
    videoRef.current.srcObject = stream;
  }
  if (screenRef.current && screenStream && screenRef.current.srcObject !== screenStream) {
    screenRef.current.srcObject = screenStream;
  }
  const tileStyle = large ? { ...styles.videoTile, ...styles.videoTileLarge } : styles.videoTile;
  const connectionLost = connectionState === 'failed' || connectionState === 'disconnected';
  return (
    <div style={tileStyle}>
      <div style={styles.videoWrap}>
        {screenStream && (
          <video ref={screenRef} autoPlay playsInline style={styles.video} />
        )}
        {stream && (
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
        )}
        {!stream && !screenStream && !connectionLost && (
          <div style={styles.videoPlaceholder}>En attente…</div>
        )}
        {connectionLost && (
          <div style={styles.connectionLostOverlay}>
            <span style={styles.connectionLostText}>Connexion perdue</span>
            {onReconnect && (
              <button type="button" onClick={onReconnect} style={styles.reconnectBtn}>
                Réessayer
              </button>
            )}
          </div>
        )}
        {onPin && (
          <button
            type="button"
            onClick={onPin}
            style={styles.pinBtn}
            title={isPinned ? 'Ne plus mettre en avant' : 'Mettre en avant'}
            aria-pressed={isPinned}
          >
            {isPinned ? '📌 Désépingler' : '📌 Mettre en avant'}
          </button>
        )}
        {reaction && <span style={styles.reactionOverlay}>{reaction}</span>}
        {handRaised && <span style={styles.handRaisedOverlay}>🙋</span>}
        {frame && <span style={styles.frameBadge}>{frame}</span>}
      </div>
      <span style={styles.videoLabel}>
        {displayName ?? peerId.slice(0, 8)}
        {role === 'teacher' && <span style={styles.videoLabelRole}> · Prof</span>}
        {role === 'student' && <span style={styles.videoLabelRole}> · Élève</span>}
        {isController && <span style={styles.videoLabelRole}> · 🎛️ Pilote</span>}
        {isPinned && <span style={styles.pinnedBadge}> 📌</span>}
        <span style={styles.videoLabelIcons}>
          {video ? ' 📹' : ' 📵'} {audio ? ' 🎤' : ' 🔇'}
        </span>
      </span>
    </div>
  );
});

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
    flexWrap: 'wrap',
    gap: '0.75rem',
    padding: '0.6rem 1rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    boxShadow: 'var(--shadow-sm)',
  },
  title: { margin: 0, fontSize: '1.1rem', flex: 1 },
  badge: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  p2pBadge: {
    fontSize: '0.8rem',
    padding: '0.2rem 0.5rem',
    background: 'rgba(0,0,0,0.08)',
    borderRadius: 'var(--radius)',
  },
  modeRelay: {
    fontSize: '0.8rem',
    padding: '0.2rem 0.5rem',
    background: 'rgba(76, 175, 80, 0.15)',
    color: 'var(--text)',
    borderRadius: 'var(--radius)',
  },
  modeServer: {
    fontSize: '0.8rem',
    padding: '0.2rem 0.5rem',
    background: 'rgba(33, 150, 243, 0.15)',
    color: 'var(--text)',
    borderRadius: 'var(--radius)',
  },
  errorBadge: {
    fontSize: '0.8rem',
    color: 'var(--danger)',
    maxWidth: 280,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  leaveBtn: {
    padding: '0.5rem 1rem',
    background: 'var(--danger)',
    color: '#fff',
    borderRadius: 'var(--radius)',
  },
  retryBtn: {
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    borderRadius: 'var(--radius)',
  },
  contributionBadge: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    background: 'rgba(88, 166, 255, 0.12)',
    padding: '0.2rem 0.5rem',
    borderRadius: 'var(--radius)',
  },
  copyLinkBtn: {
    padding: '0.35rem 0.75rem',
    fontSize: '0.85rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  lockBtn: {
    padding: '0.35rem 0.75rem',
    fontSize: '0.85rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  lockOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  lockCard: {
    background: 'var(--surface)',
    padding: '1.5rem',
    borderRadius: 'var(--radius)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    minWidth: 280,
  },
  lockTitle: { margin: '0 0 0.5rem', fontSize: '1.1rem' },
  lockHint: { margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-muted)' },
  lockInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.5rem',
    marginBottom: '0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '1rem',
  },
  lockSubmit: { padding: '0.5rem 1rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' },
  lockCancel: { padding: '0.5rem 1rem', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', marginRight: '0.5rem' },
  lockActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' },
  kickBtn: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    background: 'var(--danger)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
  },
  leaveOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    animation: 'nodle-fade-in 0.2s ease-out',
  },
  leaveModal: {
    background: 'var(--surface)',
    padding: '1.5rem 1.75rem',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    minWidth: 320,
  },
  leaveTitle: { margin: 0, fontSize: '1.25rem', fontWeight: 600 },
  leaveHint: { margin: '0.5rem 0 1.25rem', fontSize: '0.95rem', color: 'var(--text-muted)' },
  leaveActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' },
  leaveCancel: {
    padding: '0.5rem 1.25rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-sm)',
  },
  leaveConfirm: {
    padding: '0.5rem 1.25rem',
    background: 'var(--danger)',
    color: '#fff',
    borderRadius: 'var(--radius-sm)',
  },
  timerOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    animation: 'nodle-fade-in 0.2s ease-out',
  },
  timerModal: {
    background: 'var(--surface)',
    padding: '1.5rem',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    minWidth: 280,
  },
  timerTitle: { margin: 0, fontSize: '1.15rem', fontWeight: 600 },
  timerHint: { margin: '0.35rem 0 1rem', fontSize: '0.9rem', color: 'var(--text-muted)' },
  timerButtons: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' },
  timerBtn: {
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.95rem',
  },
  timerCancel: {
    padding: '0.4rem 0.8rem',
    background: 'var(--surface-hover)',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  timerFloating: {
    position: 'fixed',
    bottom: '5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
    zIndex: 500,
    animation: 'nodle-slide-up 0.3s ease-out',
  },
  timerLabel: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  timerCount: { fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  handQueue: {
    marginBottom: '1rem',
    padding: '0.75rem',
    background: 'var(--accent-soft)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  handQueueTitle: { display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' },
  handQueueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.25rem 0',
    fontSize: '0.9rem',
  },
  handQueueRank: {
    width: '1.5rem',
    height: '1.5rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: '50%',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  mediaBanner: {
    padding: '0.5rem 1rem',
    background: 'rgba(255, 152, 0, 0.15)',
    color: 'var(--text)',
    fontSize: '0.9rem',
    textAlign: 'center',
    borderBottom: '1px solid var(--border)',
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
  videoClassLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  mainStage: {
    flex: '0 0 auto',
    padding: '0.5rem',
    maxHeight: '40%',
    minHeight: 120,
  },
  mainStageLabel: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginBottom: '0.25rem',
  },
  videoGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '0.35rem',
    padding: '0.5rem',
    overflow: 'auto',
    minHeight: 0,
    alignContent: 'start',
  },
  videoTileWrap: {
    minWidth: 0,
    minHeight: 0,
  },
  videoTile: {
    position: 'relative',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    background: 'var(--surface)',
    aspectRatio: '16/10',
    height: '100%',
    minHeight: 90,
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border)',
  },
  videoTileLarge: {
    aspectRatio: '16/9',
    minHeight: 200,
    maxHeight: '100%',
  },
  videoLabelRole: {
    opacity: 0.9,
    fontSize: '0.85em',
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
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '1rem',
    color: 'var(--text-muted)',
    background: 'var(--surface-hover)',
  },
  videoPlaceholderTitle: { fontWeight: 600, fontSize: '1rem' },
  videoPlaceholderSub: { fontSize: '0.85rem', opacity: 0.9 },
  mutedBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0.5rem 0.75rem',
    background: 'rgba(0,0,0,0.75)',
    color: '#fff',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  mutedBannerIcon: { fontSize: '1.25rem' },
  connectionLostOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    padding: '1rem',
  },
  connectionLostText: { fontSize: '1rem', fontWeight: 600 },
  reconnectBtn: {
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  pinBtn: {
    position: 'absolute',
    top: '0.35rem',
    left: '0.35rem',
    padding: '0.3rem 0.5rem',
    fontSize: '0.75rem',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
  },
  pinnedBadge: { opacity: 0.9 },
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
    flexWrap: 'wrap',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    justifyContent: 'center',
    alignItems: 'center',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
    boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
  },
  controlGroup: {
    display: 'flex',
    gap: '0.25rem',
    flexWrap: 'wrap',
  },
  controlBtn: {
    padding: '0.5rem 1rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    borderRadius: 'var(--radius)',
  },
  controlBtnOff: { opacity: 0.9, border: '2px solid var(--danger)', background: 'rgba(200, 80, 80, 0.15)' },
  controlBtnHandRaised: { background: 'var(--accent)', color: '#fff' },
  shortcutsHint: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    flexBasis: '100%',
    textAlign: 'center',
  },
  controlIcon: { marginRight: '0.25rem' },
  controlLabel: { fontSize: '0.85rem' },
  reactionBar: { display: 'flex', gap: '0.25rem' },
  reactionBtn: {
    padding: '0.35rem 0.5rem',
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
    fontSize: '1.1rem',
  },
  leaveControlBtn: {
    padding: '0.5rem 1rem',
    background: 'var(--danger)',
    color: '#fff',
    borderRadius: 'var(--radius)',
  },
  videoLabelIcons: { opacity: 0.8, fontSize: '0.75em' },
  reactionOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '3rem',
    pointerEvents: 'none',
    textShadow: '0 0 8px #000',
    animation: 'nodle-reaction-pop 0.35s ease-out',
  },
  handRaisedOverlay: {
    position: 'absolute',
    top: '0.25rem',
    right: '0.25rem',
    fontSize: '1.5rem',
    pointerEvents: 'none',
  },
  frameBadge: {
    position: 'absolute',
    bottom: '1.75rem',
    right: '0.35rem',
    fontSize: '1.25rem',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
  },
  weatherSummary: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    padding: '0.2rem 0.5rem',
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
  },
  weatherBar: {
    display: 'flex',
    gap: '0.2rem',
  },
  weatherBtn: {
    padding: '0.35rem 0.5rem',
    fontSize: '1.1rem',
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
  },
  weatherBtnActive: {
    background: 'var(--accent)',
    boxShadow: '0 0 0 2px var(--accent)',
  },
  frameBar: { display: 'flex', alignItems: 'center' },
  frameSelect: {
    padding: '0.35rem 0.5rem',
    fontSize: '0.9rem',
    background: 'var(--surface-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
  },
  pollBtn: {
    padding: '0.5rem 0.75rem',
    background: 'var(--success)',
    color: '#fff',
    fontSize: '0.9rem',
  },
  takeControlBtn: {
    padding: '0.5rem 0.75rem',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.85rem',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
  },
  controllerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  controllerBadge: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--accent)',
  },
  delegateSelect: {
    padding: '0.35rem 0.5rem',
    fontSize: '0.8rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  participantsPanel: {
    flex: 1,
    overflow: 'auto',
    padding: '0.75rem',
  },
  participantsHint: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    margin: '0 0 0.75rem',
  },
  participantRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    background: 'var(--surface-hover)',
    borderRadius: 'var(--radius)',
    marginBottom: '0.35rem',
  },
  participantName: { flex: 1, fontSize: '0.9rem' },
  participantIcons: { fontSize: '0.85rem', opacity: 0.8 },
  handRaisedBadge: {
    fontSize: '0.8rem',
    color: 'var(--accent)',
    background: 'rgba(88, 166, 255, 0.15)',
    padding: '0.2rem 0.4rem',
    borderRadius: 'var(--radius)',
  },
  participantsEmpty: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    marginTop: '1rem',
  },
  sidebar: {
    width: 380,
    minWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid var(--border)',
    background: 'var(--surface)',
    transition: 'width 0.2s ease, min-width 0.2s ease',
  },
  sidebarCollapsed: {
    width: 0,
    minWidth: 0,
    overflow: 'hidden',
    borderLeft: 'none',
  },
  sidebarExpandBtn: {
    alignSelf: 'center',
    width: 36,
    height: 80,
    padding: 0,
    fontSize: '1rem',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius) 0 0 var(--radius)',
    flexShrink: 0,
  },
  settingsBtn: {
    padding: '0.4rem 0.6rem',
    fontSize: '1.1rem',
    background: 'transparent',
    color: 'var(--text-muted)',
  },
  sidebarCollapseBtn: {
    padding: '0.35rem',
    fontSize: '0.9rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  panelFallback: {
    padding: '1.5rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
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
  unreadBadge: {
    marginLeft: '0.35rem',
    padding: '0.1rem 0.4rem',
    borderRadius: '999px',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.75rem',
  },
  roleTeacher: { fontSize: '0.85rem', marginLeft: '0.5rem', color: 'var(--accent)' },
  roleStudent: { fontSize: '0.85rem', marginLeft: '0.5rem', color: 'var(--text-muted)' },
  roleBadgeTeacher: {
    fontSize: '0.75rem',
    marginLeft: '0.25rem',
    padding: '0.1rem 0.35rem',
    borderRadius: 'var(--radius)',
    background: 'rgba(88, 166, 255, 0.2)',
    color: 'var(--accent)',
  },
  pilotBadge: {
    fontSize: '0.75rem',
    marginLeft: '0.25rem',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  roleBadgeStudent: {
    fontSize: '0.75rem',
    marginLeft: '0.25rem',
    padding: '0.1rem 0.35rem',
    borderRadius: 'var(--radius)',
    background: 'var(--surface-hover)',
    color: 'var(--text-muted)',
  },
  panel: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
};
