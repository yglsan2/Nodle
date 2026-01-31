package fr.nodle.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * API simple pour créer/lister des salles (cours).
 * En production, lier à des organisations (écoles, AFPA).
 */
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final Map<String, RoomInfo> rooms = new ConcurrentHashMap<>();

    @PostMapping
    public ResponseEntity<RoomInfo> create(@RequestBody CreateRoomRequest request) {
        String id = request.getName() != null && !request.getName().isBlank()
                ? slug(request.getName()) + "-" + UUID.randomUUID().toString().substring(0, 8)
                : UUID.randomUUID().toString();
        RoomInfo room = new RoomInfo(id, request.getName() != null ? request.getName() : "Salle " + id);
        rooms.put(id, room);
        return ResponseEntity.ok(room);
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoomInfo> get(@PathVariable String id) {
        RoomInfo room = rooms.get(id);
        return room != null ? ResponseEntity.ok(room) : ResponseEntity.notFound().build();
    }

    @GetMapping
    public ResponseEntity<Map<String, RoomInfo>> list() {
        return ResponseEntity.ok(rooms);
    }

    private static String slug(String name) {
        return name.toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
    }

    public record CreateRoomRequest(String name, String organizationId) {}
    public record RoomInfo(String id, String name) {}
}
