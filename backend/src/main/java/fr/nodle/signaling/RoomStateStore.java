package fr.nodle.signaling;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * État des salles : verrouillage et mot de passe.
 * Partagé entre RoomController (REST lock/unlock) et RoomSessions (vérification au join).
 */
@Component
public class RoomStateStore {

    private final Map<String, RoomState> byRoom = new ConcurrentHashMap<>();

    public boolean isLocked(String roomId) {
        RoomState s = byRoom.get(roomId);
        return s != null && s.locked;
    }

    public String getPassword(String roomId) {
        RoomState s = byRoom.get(roomId);
        return s == null ? null : s.password;
    }

    public void setLocked(String roomId, boolean locked, String password) {
        if (locked && password != null && !password.isBlank()) {
            byRoom.put(roomId, new RoomState(true, password));
        } else {
            byRoom.remove(roomId);
        }
    }

    private record RoomState(boolean locked, String password) {}
}
