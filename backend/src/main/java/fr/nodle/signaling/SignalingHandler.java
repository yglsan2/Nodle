package fr.nodle.signaling;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Gère le signaling WebRTC (offre/réponse/ICE) pour les salles.
 * Permet aux pairs de se connecter en P2P via le relais hybride.
 * Chaque bloc critique respecte la règle : 1 try, 1 catch, 1 finally.
 */
public class SignalingHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SignalingHandler.class);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, RoomSessions> rooms = new ConcurrentHashMap<>();
    private final RoomStateStore roomStateStore;

    public SignalingHandler(RoomStateStore roomStateStore) {
        this.roomStateStore = roomStateStore;
    }

    /**
     * Appelé lorsqu'une nouvelle session WebSocket est établie.
     * La salle et le peerId sont envoyés au premier message client.
     *
     * @param session la session WebSocket
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        try {
            log.info("[Nodle][Signaling] connection established sessionId={}", session.getId());
        } catch (Exception e) {
            log.warn("[Nodle][Signaling] afterConnectionEstablished log failed", e);
        } finally {
            // no cleanup
        }
    }

    /**
     * Traite un message texte reçu : désérialise le JSON et délègue à la salle.
     *
     * @param session la session émettrice
     * @param message le message texte (JSON)
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            SignalingMessage msg = objectMapper.readValue(message.getPayload(), SignalingMessage.class);
            String roomId = msg.getRoomId();
            if (roomId == null || roomId.isBlank()) {
                log.warn("[Nodle][Signaling] message without roomId ignored");
                return;
            }
            rooms.computeIfAbsent(roomId, k -> new RoomSessions())
                    .handle(session, msg, this::broadcastInRoom, this::sendToSession, roomStateStore);
        } catch (Exception e) {
            log.warn("[Nodle][Signaling] handleTextMessage failed sessionId={}", session.getId(), e);
            throw e;
        } finally {
            // no cleanup
        }
    }

    /**
     * Envoie un message à une seule session (ex. peersInRoom, chatHistory, pong).
     *
     * @param session la session cible
     * @param msg     le message à envoyer
     */
    private void sendToSession(WebSocketSession session, SignalingMessage msg) {
        if (session == null || !session.isOpen()) return;
        try {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(msg)));
        } catch (Exception e) {
            log.warn("[Nodle][Signaling] sendToSession failed sessionId={}", session.getId(), e);
        } finally {
            // no cleanup
        }
    }

    /**
     * Diffuse un message à tous les pairs de la salle (sauf excludeSessionId), avec filtrage optionnel par toPeerId.
     *
     * @param roomId          identifiant de la salle
     * @param excludeSessionId session à exclure (émetteur)
     * @param msg             message à diffuser
     */
    private void broadcastInRoom(String roomId, String excludeSessionId, SignalingMessage msg) {
        RoomSessions room = rooms.get(roomId);
        if (room == null) return;
        try {
            String payload = objectMapper.writeValueAsString(msg);
            String toPeerId = msg.getToPeerId();
            room.sessions().forEach((peerId, ws) -> {
                try {
                    if (!ws.isOpen()) return;
                    if (ws.getId().equals(excludeSessionId)) return;
                    if (toPeerId != null && !toPeerId.isBlank() && !toPeerId.equals(peerId)) return;
                    ws.sendMessage(new TextMessage(payload));
                } catch (IOException e) {
                    log.warn("[Nodle][Signaling] broadcast send failed peerId={}", peerId, e);
                } finally {
                    // no cleanup
                }
            });
        } catch (Exception e) {
            log.warn("[Nodle][Signaling] broadcastInRoom failed roomId={}", roomId, e);
        } finally {
            // no cleanup
        }
    }

    /**
     * Appelé à la fermeture de la session ; retire la session de toutes les salles.
     *
     * @param session la session fermée
     * @param status  le statut de fermeture
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        try {
            rooms.values().forEach(room -> room.remove(session));
            log.info("[Nodle][Signaling] connection closed sessionId={} status={}", session.getId(), status);
        } catch (Exception e) {
            log.warn("[Nodle][Signaling] afterConnectionClosed failed", e);
        } finally {
            // no cleanup
        }
    }
}
