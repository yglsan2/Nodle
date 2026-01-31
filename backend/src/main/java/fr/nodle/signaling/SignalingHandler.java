package fr.nodle.signaling;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 */
public class SignalingHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, RoomSessions> rooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // La salle et le peerId sont envoyés au premier message
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        SignalingMessage msg = objectMapper.readValue(message.getPayload(), SignalingMessage.class);
        String roomId = msg.getRoomId();
        if (roomId == null || roomId.isBlank()) return;

        rooms.computeIfAbsent(roomId, k -> new RoomSessions()).handle(session, msg, this::broadcastInRoom);
    }

    private void broadcastInRoom(String roomId, String excludeSessionId, SignalingMessage msg) {
        RoomSessions room = rooms.get(roomId);
        if (room == null) return;
        try {
            String payload = objectMapper.writeValueAsString(msg);
            room.sessions().forEach((peerId, ws) -> {
                if (ws.isOpen() && !ws.getId().equals(excludeSessionId)) {
                    try {
                        ws.sendMessage(new TextMessage(payload));
                    } catch (IOException ignored) {}
                }
            });
        } catch (Exception ignored) {}
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        rooms.values().forEach(room -> room.remove(session));
    }
}
