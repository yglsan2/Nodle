package fr.nodle.signaling;

import lombok.Data;

@Data
public class SignalingMessage {
    private String type;   // "join" | "offer" | "answer" | "ice"
    private String roomId;
    private String fromPeerId;
    private String toPeerId;
    private Object payload; // SDP ou candidat ICE
}
