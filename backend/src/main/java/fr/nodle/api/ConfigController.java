package fr.nodle.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Configuration publique pour le client : serveurs ICE (STUN/TURN) pour
 * traverser les NAT et permettre à toute une classe de se connecter.
 */
@RestController
public class ConfigController {

    @Value("${nodle.ice.stun-urls:stun:stun.l.google.com:19302}")
    private String stunUrls;

    @Value("${nodle.ice.turn-urls:}")
    private String turnUrls;

    @Value("${nodle.ice.turn-username:}")
    private String turnUsername;

    @Value("${nodle.ice.turn-credential:}")
    private String turnCredential;

    /** URL du WebSocket du SFU (mediasoup), vide si mode mesh uniquement */
    @Value("${nodle.sfu.ws-url:}")
    private String sfuWsUrl;

    /** URL du WebSocket de signaling à utiliser (vide = même origine). Permet un relais public pour "sans serveur". */
    @Value("${nodle.signaling.ws-url:}")
    private String signalingWsUrl;

    @GetMapping("/api/config")
    public ResponseEntity<Map<String, Object>> config() {
        List<Map<String, Object>> iceServers = new ArrayList<>();

        // STUN (toujours)
        for (String url : stunUrls.split(",")) {
            String u = url.trim();
            if (!u.isEmpty()) {
                iceServers.add(Map.of("urls", u));
            }
        }
        if (iceServers.isEmpty()) {
            iceServers.add(Map.of("urls", "stun:stun.l.google.com:19302"));
        }

        // TURN (optionnel, pour NAT stricts – indispensable pour les classes)
        if (turnUrls != null && !turnUrls.isBlank()) {
            for (String url : turnUrls.split(",")) {
                String u = url.trim();
                if (!u.isEmpty()) {
                    if (turnUsername != null && !turnUsername.isBlank() && turnCredential != null) {
                        iceServers.add(Map.of(
                                "urls", u,
                                "username", turnUsername,
                                "credential", turnCredential
                        ));
                    } else {
                        iceServers.add(Map.of("urls", u));
                    }
                }
            }
        }

        // Hybride : ordre des URLs de signaling (relay en premier si configuré, puis serveur). Le client essaie dans l'ordre et bascule automatiquement si l'un échoue.
        List<String> signalingUrlList = new ArrayList<>();
        if (signalingWsUrl != null && !signalingWsUrl.isBlank()) {
            signalingUrlList.add(signalingWsUrl.trim());
        }
        signalingUrlList.add(""); // vide = même origine (backend)

        return ResponseEntity.ok(Map.of(
                "iceServers", iceServers,
                "sfuWsUrl", sfuWsUrl != null ? sfuWsUrl : "",
                "signalingWsUrl", signalingWsUrl != null ? signalingWsUrl : "",
                "signalingUrls", signalingUrlList
        ));
    }
}
