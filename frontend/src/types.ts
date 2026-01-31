/** Message de chat : texte, GIF, pièce jointe, bloc code */
export type ChatMessage = {
  id: string;
  fromPeerId: string;
  displayName: string;
  at: number;
  text?: string;
  gifUrl?: string;
  attachment?: { url: string; name: string; contentType: string };
  codeBlock?: { lang: string; code: string };
};

/** Événement tableau blanc (trait) */
export type WhiteboardStroke = {
  id: string;
  fromPeerId: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
};
