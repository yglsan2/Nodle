package fr.nodle.signaling;

import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

final class RoomSessions {
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    void handle(WebSocketSession session, SignalingMessage msg, Broadcast broadcast) {
        switch (msg.getType() == null ? "" : msg.getType()) {
            case "join" -> {
                String peerId = msg.getFromPeerId() != null ? msg.getFromPeerId() : session.getId();
                sessions.put(peerId, session);
                msg.setFromPeerId(peerId);
                broadcast.send(msg.getRoomId(), session.getId(), msg);
            }
            case "offer", "answer", "ice" -> {
                if (msg.getFromPeerId() == null) msg.setFromPeerId(session.getId());
                broadcast.send(msg.getRoomId(), session.getId(), msg);
            }
            default -> {}
        }
    }

    void remove(WebSocketSession session) {
        sessions.entrySet().removeIf(e -> e.getValue().getId().equals(session.getId()));
    }

    Map<String, WebSocketSession> sessions() {
        return sessions;
    }

    @FunctionalInterface
    interface Broadcast {
        void send(String roomId, String excludeSessionId, SignalingMessage msg);
    }
}
