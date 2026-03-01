package fr.nodle.api;

import fr.nodle.signaling.RoomStateStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * API REST pour créer, récupérer et lister les salles (cours).
 * Verrouillage et mot de passe : lock/unlock pour protéger l'accès.
 * Règle de robustesse : 1 try, 1 catch, 1 finally par bloc critique.
 */
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private static final Logger log = LoggerFactory.getLogger(RoomController.class);

    private final Map<String, RoomInfo> rooms = new ConcurrentHashMap<>();
    private final RoomStateStore roomStateStore;

    public RoomController(RoomStateStore roomStateStore) {
        this.roomStateStore = roomStateStore;
    }

    /**
     * Crée une salle ou retourne l'existante si le slug (nom normalisé) existe déjà.
     *
     * @param request corps de la requête (name, optionnellement organizationId)
     * @return la salle créée ou existante (200), ou erreur (500 en cas d'exception)
     */
    @PostMapping
    public ResponseEntity<RoomInfo> create(@RequestBody CreateRoomRequest request) {
        try {
            String name = request.getName() != null && !request.getName().isBlank() ? request.getName().trim() : null;
            String id;
            if (name != null) {
                String slug = slug(name);
                id = slug.isEmpty() ? UUID.randomUUID().toString() : slug;
                RoomInfo existing = rooms.get(id);
                if (existing != null) {
                    log.info("[Nodle][RoomController] create existing roomId={}", id);
                    return ResponseEntity.ok(existing);
                }
            } else {
                id = UUID.randomUUID().toString();
            }
            RoomInfo room = new RoomInfo(id, name != null ? name : "Salle " + id);
            rooms.put(id, room);
            log.info("[Nodle][RoomController] create roomId={} name={}", id, room.name());
            return ResponseEntity.ok(room);
        } catch (Exception e) {
            log.warn("[Nodle][RoomController] create failed", e);
            throw e;
        } finally {
            // no cleanup
        }
    }

    /**
     * Récupère une salle par son identifiant.
     *
     * @param id identifiant de la salle
     * @return 200 + RoomInfo si trouvée, 404 sinon
     */
    @GetMapping("/{id}")
    public ResponseEntity<RoomInfo> get(@PathVariable String id) {
        try {
            RoomInfo room = rooms.get(id);
            return room != null ? ResponseEntity.ok(room) : ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.warn("[Nodle][RoomController] get failed id={}", id, e);
            throw e;
        } finally {
            // no cleanup
        }
    }

    /**
     * Liste toutes les salles.
     *
     * @return 200 + map id -> RoomInfo
     */
    @GetMapping
    public ResponseEntity<Map<String, RoomInfo>> list() {
        try {
            return ResponseEntity.ok(rooms);
        } catch (Exception e) {
            log.warn("[Nodle][RoomController] list failed", e);
            throw e;
        } finally {
            // no cleanup
        }
    }

    /**
     * Verrouille la salle avec un mot de passe.
     *
     * @param id   identifiant de la salle
     * @param body corps { "password": "xxx" }
     * @return 200 si la salle existe, 404 sinon
     */
    @PostMapping("/{id}/lock")
    public ResponseEntity<Void> lock(@PathVariable String id, @RequestBody Map<String, String> body) {
        try {
            if (rooms.get(id) == null) return ResponseEntity.notFound().build();
            String password = body != null && body.containsKey("password") ? body.get("password") : null;
            roomStateStore.setLocked(id, true, password != null ? password : "");
            log.info("[Nodle][RoomController] room locked roomId={}", id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("[Nodle][RoomController] lock failed id={}", id, e);
            throw e;
        } finally {
            // no cleanup
        }
    }

    /**
     * Déverrouille la salle.
     *
     * @param id identifiant de la salle
     * @return 200 si la salle existe, 404 sinon
     */
    @DeleteMapping("/{id}/lock")
    public ResponseEntity<Void> unlock(@PathVariable String id) {
        try {
            if (rooms.get(id) == null) return ResponseEntity.notFound().build();
            roomStateStore.setLocked(id, false, null);
            log.info("[Nodle][RoomController] room unlocked roomId={}", id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("[Nodle][RoomController] unlock failed id={}", id, e);
            throw e;
        } finally {
            // no cleanup
        }
    }

    /**
     * Indique si la salle est verrouillée.
     *
     * @param id identifiant de la salle
     * @return 200 + { locked: boolean } ou 404
     */
    @GetMapping("/{id}/state")
    public ResponseEntity<Map<String, Boolean>> state(@PathVariable String id) {
        try {
            if (rooms.get(id) == null) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(Map.of("locked", roomStateStore.isLocked(id)));
        } catch (Exception e) {
            log.warn("[Nodle][RoomController] state failed id={}", id, e);
            throw e;
        } finally {
            // no cleanup
        }
    }

    /**
     * Normalise un nom en slug (minuscules, tirets, sans caractères spéciaux).
     *
     * @param name nom brut
     * @return slug
     */
    private static String slug(String name) {
        try {
            return name.toLowerCase()
                    .replaceAll("[^a-z0-9]+", "-")
                    .replaceAll("^-|-$", "");
        } catch (Exception e) {
            return "";
        } finally {
            // no cleanup
        }
    }

    /** Requête de création de salle (body POST /api/rooms). */
    public record CreateRoomRequest(String name, String organizationId) {}

    /** Représentation d'une salle (id, nom). */
    public record RoomInfo(String id, String name) {}
}
