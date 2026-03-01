package fr.nodle.signaling;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Représente les sessions WebSocket d'une même salle (room).
 * Gère les messages de type join, ping, chat, offer, answer, ice, et envoie
 * peersInRoom et chatHistory aux nouveaux participants.
 * Règle de robustesse : 1 try, 1 catch, 1 finally par bloc critique.
 */
final class RoomSessions {

    private static final Logger log = LoggerFactory.getLogger(RoomSessions.class);
    private static final int MAX_CHAT_HISTORY = 100;

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> peerRoles = new ConcurrentHashMap<>();
    private final List<Object> chatHistory = new ArrayList<>();
    private volatile String hostPeerId;
    /** Prof qui a les commandes (prise de contrôle / délégation). */
    private volatile String controllerPeerId;

    /**
     * Traite un message entrant : join, ping, chat, offer, answer, ice, kick ou défaut (broadcast).
     *
     * @param session       la session émettrice
     * @param msg           le message désérialisé
     * @param broadcast     callback pour diffuser en salle (en excluant une session)
     * @param sendToSession callback pour envoyer à une seule session
     * @param roomStateStore état des salles (verrouillage / mot de passe)
     */
    void handle(WebSocketSession session, SignalingMessage msg, Broadcast broadcast, SendToSession sendToSession, RoomStateStore roomStateStore) {
        String type = msg.getType() == null ? "" : msg.getType();
        try {
            switch (type) {
                case "join" -> handleJoin(session, msg, broadcast, sendToSession, roomStateStore);
                case "ping" -> handlePing(session, msg, sendToSession);
                case "chat" -> handleChat(session, msg, broadcast);
                case "kick" -> handleKick(session, msg, sendToSession);
                case "takeControl" -> handleTakeControl(session, msg, broadcast);
                case "delegateControl" -> handleDelegateControl(session, msg, broadcast);
                case "offer", "answer", "ice" -> handleWebRTC(session, msg, broadcast);
                default -> handleDefault(session, msg, broadcast);
            }
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] handle failed type={} sessionId={}", type, session.getId(), e);
        } finally {
            // no cleanup
        }
    }

    @SuppressWarnings("unchecked")
    private void handleJoin(WebSocketSession session, SignalingMessage msg, Broadcast broadcast, SendToSession sendToSession, RoomStateStore roomStateStore) {
        try {
            String roomId = msg.getRoomId();
            if (roomStateStore.isLocked(roomId)) {
                String givenPassword = null;
                if (msg.getPayload() instanceof Map<?, ?> map) {
                    Object p = map.get("password");
                    givenPassword = p != null ? p.toString() : null;
                }
                String expected = roomStateStore.getPassword(roomId);
                if (expected == null || !expected.equals(givenPassword)) {
                    SignalingMessage rejected = new SignalingMessage();
                    rejected.setType("joinRejected");
                    rejected.setRoomId(roomId);
                    rejected.setPayload(Map.of("reason", givenPassword == null || givenPassword.isBlank() ? "password_required" : "wrong_password"));
                    sendToSession.send(session, rejected);
                    log.info("[Nodle][RoomSessions] join rejected (locked) roomId={} sessionId={}", roomId, session.getId());
                    return;
                }
            }

            String peerId = msg.getFromPeerId() != null && !msg.getFromPeerId().isBlank()
                    ? msg.getFromPeerId() : session.getId();
            if (sessions.isEmpty()) hostPeerId = peerId;
            sessions.put(peerId, session);
            msg.setFromPeerId(peerId);
            @SuppressWarnings("unchecked")
            Map<String, Object> payloadMap = msg.getPayload() instanceof Map ? new HashMap<>((Map<String, Object>) msg.getPayload()) : new HashMap<>();
            String role = payloadMap.get("role") != null ? payloadMap.get("role").toString() : "participant";
            peerRoles.put(peerId, role);
            payloadMap.put("hostPeerId", hostPeerId);
            msg.setPayload(payloadMap);
            broadcast.send(msg.getRoomId(), session.getId(), msg);

            List<String> peerIds = new ArrayList<>(sessions.keySet());
            peerIds.remove(peerId);
            Map<String, Object> peersPayload = new HashMap<>();
            peersPayload.put("peerIds", peerIds);
            peersPayload.put("hostPeerId", hostPeerId != null ? hostPeerId : peerId);
            peersPayload.put("controllerPeerId", controllerPeerId);
            SignalingMessage peersMsg = new SignalingMessage();
            peersMsg.setType("peersInRoom");
            peersMsg.setRoomId(msg.getRoomId());
            peersMsg.setFromPeerId(peerId);
            peersMsg.setPayload(peersPayload);
            sendToSession.send(session, peersMsg);
            log.info("[Nodle][RoomSessions] peersInRoom sent roomId={} peerId={} count={}", msg.getRoomId(), peerId, peerIds.size());

            if (!chatHistory.isEmpty()) {
                SignalingMessage historyMsg = new SignalingMessage();
                historyMsg.setType("chatHistory");
                historyMsg.setRoomId(msg.getRoomId());
                historyMsg.setPayload(Map.of("messages", new ArrayList<>(chatHistory)));
                sendToSession.send(session, historyMsg);
            }
            log.info("[Nodle][RoomSessions] join roomId={} peerId={}", msg.getRoomId(), peerId);
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] handleJoin failed", e);
        } finally {
            // no cleanup
        }
    }

    @SuppressWarnings("unchecked")
    private void handleTakeControl(WebSocketSession session, SignalingMessage msg, Broadcast broadcast) {
        try {
            String fromPeerId = msg.getFromPeerId();
            if (fromPeerId == null) return;
            if (!"teacher".equals(peerRoles.get(fromPeerId))) return;
            controllerPeerId = fromPeerId;
            SignalingMessage out = new SignalingMessage();
            out.setType("controllerChange");
            out.setRoomId(msg.getRoomId());
            out.setFromPeerId(fromPeerId);
            out.setPayload(Map.of("controllerPeerId", controllerPeerId));
            broadcast.send(msg.getRoomId(), null, out);
            log.info("[Nodle][RoomSessions] takeControl roomId={} controllerPeerId={}", msg.getRoomId(), controllerPeerId);
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] handleTakeControl failed", e);
        } finally {
            // no cleanup
        }
    }

    @SuppressWarnings("unchecked")
    private void handleDelegateControl(WebSocketSession session, SignalingMessage msg, Broadcast broadcast) {
        try {
            String fromPeerId = msg.getFromPeerId();
            if (fromPeerId == null || !fromPeerId.equals(controllerPeerId)) return;
            String targetPeerId = null;
            if (msg.getPayload() instanceof Map<?, ?> map) {
                Object p = map.get("targetPeerId");
                targetPeerId = p != null ? p.toString() : null;
            }
            if (targetPeerId == null || targetPeerId.isBlank()) return;
            if (!"teacher".equals(peerRoles.get(targetPeerId))) return;
            if (!sessions.containsKey(targetPeerId)) return;
            controllerPeerId = targetPeerId;
            SignalingMessage out = new SignalingMessage();
            out.setType("controllerChange");
            out.setRoomId(msg.getRoomId());
            out.setFromPeerId(fromPeerId);
            out.setPayload(Map.of("controllerPeerId", controllerPeerId));
            broadcast.send(msg.getRoomId(), null, out);
            log.info("[Nodle][RoomSessions] delegateControl roomId={} newControllerPeerId={}", msg.getRoomId(), controllerPeerId);
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] handleDelegateControl failed", e);
        } finally {
            // no cleanup
        }
    }

    @SuppressWarnings("unchecked")
    private void handleKick(WebSocketSession session, SignalingMessage msg, SendToSession sendToSession) {
        try {
            String fromPeerId = msg.getFromPeerId();
            if (fromPeerId == null || !fromPeerId.equals(hostPeerId)) return;
            String peerIdToKick = null;
            if (msg.getPayload() instanceof Map<?, ?> map) {
                Object p = map.get("peerId");
                peerIdToKick = p != null ? p.toString() : null;
            }
            if (peerIdToKick == null || peerIdToKick.isBlank()) return;
            WebSocketSession target = sessions.get(peerIdToKick);
            if (target == null || !target.isOpen()) return;
            SignalingMessage kicked = new SignalingMessage();
            kicked.setType("kicked");
            kicked.setRoomId(msg.getRoomId());
            kicked.setPayload(Map.of("by", fromPeerId));
            sendToSession.send(target, kicked);
            sessions.remove(peerIdToKick);
            try { target.close(); } catch (Exception e) { log.warn("[Nodle][RoomSessions] close after kick failed", e); }
            log.info("[Nodle][RoomSessions] kicked roomId={} peerId={} by={}", msg.getRoomId(), peerIdToKick, fromPeerId);
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] handleKick failed", e);
        } finally {
            // no cleanup
        }
    }

    private void handlePing(WebSocketSession session, SignalingMessage msg, SendToSession sendToSession) {
        try {
            SignalingMessage pong = new SignalingMessage();
            pong.setType("pong");
            pong.setRoomId(msg.getRoomId());
            sendToSession.send(session, pong);
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] handlePing failed", e);
        } finally {
            // no cleanup
        }
    }

    private void handleChat(WebSocketSession session, SignalingMessage msg, Broadcast broadcast) {
        try {
            if (msg.getPayload() != null) {
                synchronized (chatHistory) {
                    chatHistory.add(msg.getPayload());
                    if (chatHistory.size() > MAX_CHAT_HISTORY) {
                        chatHistory.remove(0);
                    }
                }
            }
            if (msg.getFromPeerId() == null) msg.setFromPeerId(session.getId());
            broadcast.send(msg.getRoomId(), session.getId(), msg);
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] handleChat failed", e);
        } finally {
            // no cleanup
        }
    }

    private void handleWebRTC(WebSocketSession session, SignalingMessage msg, Broadcast broadcast) {
        try {
            if (msg.getFromPeerId() == null) msg.setFromPeerId(session.getId());
            broadcast.send(msg.getRoomId(), session.getId(), msg);
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] handleWebRTC failed type={}", msg.getType(), e);
        } finally {
            // no cleanup
        }
    }

    private void handleDefault(WebSocketSession session, SignalingMessage msg, Broadcast broadcast) {
        try {
            if (msg.getFromPeerId() == null) msg.setFromPeerId(session.getId());
            broadcast.send(msg.getRoomId(), session.getId(), msg);
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] handleDefault failed", e);
        } finally {
            // no cleanup
        }
    }

    /**
     * Retire la session de la salle (à la déconnexion). Si c'était l'hôte, le premier reste devient hôte.
     *
     * @param session la session à retirer
     */
    void remove(WebSocketSession session) {
        try {
            String removedPeerId = null;
            for (Map.Entry<String, WebSocketSession> e : sessions.entrySet()) {
                if (e.getValue().getId().equals(session.getId())) {
                    removedPeerId = e.getKey();
                    break;
                }
            }
            sessions.entrySet().removeIf(e -> e.getValue().getId().equals(session.getId()));
            if (removedPeerId != null) {
                peerRoles.remove(removedPeerId);
                if (removedPeerId.equals(hostPeerId) && !sessions.isEmpty()) {
                    hostPeerId = sessions.keySet().iterator().next();
                }
                if (removedPeerId.equals(controllerPeerId)) {
                    controllerPeerId = sessions.keySet().stream()
                            .filter(pid -> "teacher".equals(peerRoles.get(pid)))
                            .findFirst()
                            .orElse(null);
                }
            }
        } catch (Exception e) {
            log.warn("[Nodle][RoomSessions] remove failed", e);
        } finally {
            // no cleanup
        }
    }

    /**
     * Retourne la map des sessions de la salle (peerId -> session).
     *
     * @return la map des sessions
     */
    Map<String, WebSocketSession> sessions() {
        return sessions;
    }

    @FunctionalInterface
    interface Broadcast {
        void send(String roomId, String excludeSessionId, SignalingMessage msg);
    }

    @FunctionalInterface
    interface SendToSession {
        void send(WebSocketSession session, SignalingMessage msg);
    }
}
