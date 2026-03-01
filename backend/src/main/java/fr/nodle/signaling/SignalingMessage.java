package fr.nodle.signaling;

import lombok.Data;

/**
 * Message échangé sur le canal de signaling WebSocket (format JSON).
 * Types supportés : join, offer, answer, ice, chat, ping, pong, peersInRoom, chatHistory, muteState, etc.
 *
 * @see SignalingHandler
 * @see RoomSessions
 */
@Data
public class SignalingMessage {

    /** Type du message : "join", "offer", "answer", "ice", "chat", "ping", "pong", "peersInRoom", "chatHistory", etc. */
    private String type;

    /** Identifiant de la salle (room). */
    private String roomId;

    /** Identifiant du pair émetteur. */
    private String fromPeerId;

    /** Identifiant du pair destinataire (optionnel ; si vide, broadcast dans la salle). */
    private String toPeerId;

    /** Corps du message : SDP (offer/answer), candidat ICE, ou données métier (chat, historique, etc.). */
    private Object payload;
}
