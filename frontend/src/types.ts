/** Rôle dans la salle (pédagogique) */
export type RoomRole = 'teacher' | 'student' | 'participant';

/** Message de chat : texte, GIF, pièce jointe, bloc code. Optionnellement privé (à un participant). */
export type ChatMessage = {
  id: string;
  fromPeerId: string;
  displayName: string;
  at: number;
  text?: string;
  gifUrl?: string;
  attachment?: { url: string; name: string; contentType: string };
  codeBlock?: { lang: string; code: string };
  /** Si défini, message privé à ce participant (seul lui et l'expéditeur le voient). */
  toPeerId?: string;
};

/** Événement tableau blanc (trait) */
export type WhiteboardStroke = {
  id: string;
  fromPeerId: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
};

/** Document placé sur le tableau collaboratif (manipulable, annotable, montrable/masquable) */
export type PlacedDoc = {
  id: string;
  fileId: string;
  name: string;
  url: string;
  contentType: string;
  /** Position et transformation sur le canvas */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Visible pour tous (false = masqué) */
  visible: boolean;
  createdBy: string;
  /** Annotation texte libre (optionnel) */
  annotation?: string;
};
