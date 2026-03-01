/**
 * Types des options Nodle (niveau Teams/Zoom) : vidéo, audio, apparence, notifications.
 * Tous les champs sont persistés en localStorage pour garder les préférences entre sessions.
 */

export type VideoQualityPreset = 'auto' | '1080p' | '720p' | '480p' | '360p' | 'data-saver';

export type FrameRateOption = 15 | 24 | 30;

export type ThemeOption = 'light' | 'dark' | 'system';

export type LayoutOption = 'grid' | 'speaker';

export interface VideoSettings {
  /** Qualité cible (auto = adaptatif selon nombre de participants). */
  quality: VideoQualityPreset;
  /** Images par seconde max (15 = économique, 30 = fluide). */
  maxFrameRate: FrameRateOption;
  /** Réduire automatiquement la qualité quand la salle grossit. */
  adaptiveQuality: boolean;
  /** Id de la caméra (vide = défaut). */
  cameraDeviceId: string | null;
}

export interface AudioSettings {
  /** Annulation d’écho (recommandé). */
  echoCancellation: boolean;
  /** Réduction du bruit de fond. */
  noiseSuppression: boolean;
  /** Id du micro (vide = défaut). */
  inputDeviceId: string | null;
  /** Id du haut-parleur (vide = défaut). */
  outputDeviceId: string | null;
}

export interface AppearanceSettings {
  theme: ThemeOption;
  layout: LayoutOption;
  /** Panneau latéral replié par défaut. */
  sidebarCollapsed: boolean;
  /** Animations réduites (accessibilité). */
  reducedMotion: boolean;
  /** Rejoindre avec la caméra coupée (mode audio seul). */
  joinWithVideoOff: boolean;
}

/** Options réseau / contribution (pour topologie et UX). */
export interface NetworkSettings {
  /** Afficher que vous contribuez au relais (et permettre d'être élu relais à terme). */
  contributeToRelay: boolean;
  /** Mode éco : réduire bande passante et contribution si batterie faible ou préférence. */
  ecoMode: boolean;
  /** Mode souverain : ne rien persister après la réunion (historique, cache). */
  sovereignMode: boolean;
}

export interface NotificationSettings {
  /** Son à la réception d’un nouveau message (hors onglet chat). */
  soundOnNewMessage: boolean;
}

export interface NodleSettings {
  video: VideoSettings;
  audio: AudioSettings;
  appearance: AppearanceSettings;
  notifications: NotificationSettings;
  audioBehavior: AudioBehaviorSettings;
  network: NetworkSettings;
}

export const DEFAULT_VIDEO: VideoSettings = {
  quality: 'auto',
  maxFrameRate: 24,
  adaptiveQuality: true,
  cameraDeviceId: null,
};

export const DEFAULT_AUDIO: AudioSettings = {
  echoCancellation: true,
  noiseSuppression: true,
  inputDeviceId: null,
  outputDeviceId: null,
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'system',
  layout: 'speaker',
  sidebarCollapsed: false,
  reducedMotion: false,
  joinWithVideoOff: false,
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  soundOnNewMessage: true,
};

export interface AudioBehaviorSettings {
  pushToTalk: boolean;
}

export const DEFAULT_AUDIO_BEHAVIOR: AudioBehaviorSettings = {
  pushToTalk: false,
};

export const DEFAULT_NETWORK: NetworkSettings = {
  contributeToRelay: true,
  ecoMode: false,
  sovereignMode: false,
};

export const DEFAULT_SETTINGS: NodleSettings = {
  video: DEFAULT_VIDEO,
  audio: DEFAULT_AUDIO,
  appearance: DEFAULT_APPEARANCE,
  notifications: DEFAULT_NOTIFICATIONS,
  audioBehavior: DEFAULT_AUDIO_BEHAVIOR,
  network: DEFAULT_NETWORK,
};
