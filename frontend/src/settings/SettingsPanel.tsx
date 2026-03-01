/**
 * Panneau des réglages Nodle (vidéo, audio, apparence, notifications, raccourcis).
 * Design sobre et lisible, comparable à Teams/Zoom.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSettings } from './useSettings';
import type { VideoQualityPreset, FrameRateOption, ThemeOption, LayoutOption } from './types';

type DeviceEntry = { deviceId: string; label: string };

const VIDEO_QUALITY_LABELS: Record<VideoQualityPreset, string> = {
  auto: 'Automatique (recommandé)',
  '1080p': '1080p (Full HD)',
  '720p': '720p (HD)',
  '480p': '480p',
  '360p': '360p',
  'data-saver': 'Économie de données',
};

const FRAME_RATE_LABELS: Record<FrameRateOption, string> = {
  15: '15 images/s (léger)',
  24: '24 images/s',
  30: '30 images/s (fluide)',
};

const THEME_LABELS: Record<ThemeOption, string> = {
  light: 'Clair',
  dark: 'Sombre',
  system: 'Système',
};

const LAYOUT_LABELS: Record<LayoutOption, string> = {
  grid: 'Grille',
  speaker: 'Intervenant principal',
};

const SHORTCUTS = [
  { key: 'M', label: 'Micro on/off' },
  { key: 'V', label: 'Caméra on/off' },
  { key: 'S', label: 'Partage d’écran' },
  { key: 'H', label: 'Lever la main' },
  { key: 'Espace', label: 'Parler (push-to-talk si activé)' },
];

type Props = { onClose: () => void };

export function SettingsPanel({ onClose }: Props) {
  const { settings, update } = useSettings();
  const [videoDevices, setVideoDevices] = useState<DeviceEntry[]>([]);
  const [audioInputDevices, setAudioInputDevices] = useState<DeviceEntry[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<DeviceEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      if (cancelled) return;
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput').map((d) => ({ deviceId: d.deviceId, label: d.label || `Caméra ${d.deviceId.slice(0, 8)}` })));
      setAudioInputDevices(devices.filter((d) => d.kind === 'audioinput').map((d) => ({ deviceId: d.deviceId, label: d.label || `Micro ${d.deviceId.slice(0, 8)}` })));
      setAudioOutputDevices(devices.filter((d) => d.kind === 'audiooutput').map((d) => ({ deviceId: d.deviceId, label: d.label || `Haut-parleurs ${d.deviceId.slice(0, 8)}` })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const setVideo = useCallback((v: Partial<typeof settings.video>) => update({ video: v }), [update]);
  const setAudio = useCallback((a: Partial<typeof settings.audio>) => update({ audio: a }), [update]);
  const setAppearance = useCallback((a: Partial<typeof settings.appearance>) => update({ appearance: a }), [update]);
  const setNotifications = useCallback((n: Partial<typeof settings.notifications>) => update({ notifications: n }), [update]);

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-label="Réglages">
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Réglages</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Fermer">
            ×
          </button>
        </div>
        <div style={styles.body}>
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Vidéo</h3>
            <label style={styles.label}>
              Qualité
              <select
                value={settings.video.quality}
                onChange={(e) => setVideo({ quality: e.target.value as VideoQualityPreset })}
                style={styles.select}
              >
                {(Object.keys(VIDEO_QUALITY_LABELS) as VideoQualityPreset[]).map((q) => (
                  <option key={q} value={q}>{VIDEO_QUALITY_LABELS[q]}</option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Images par seconde
              <select
                value={settings.video.maxFrameRate}
                onChange={(e) => setVideo({ maxFrameRate: Number(e.target.value) as FrameRateOption })}
                style={styles.select}
              >
                {(Object.keys(FRAME_RATE_LABELS) as unknown as FrameRateOption[]).map((f) => (
                  <option key={f} value={f}>{FRAME_RATE_LABELS[f]}</option>
                ))}
              </select>
            </label>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.video.adaptiveQuality}
                onChange={(e) => setVideo({ adaptiveQuality: e.target.checked })}
              />
              <span>Qualité adaptative (réduit selon le nombre de participants)</span>
            </label>
            {videoDevices.length > 0 && (
              <label style={styles.label}>
                Caméra
                <select
                  value={settings.video.cameraDeviceId ?? ''}
                  onChange={(e) => setVideo({ cameraDeviceId: e.target.value || null })}
                  style={styles.select}
                >
                  <option value="">Par défaut</option>
                  {videoDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
              </label>
            )}
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Audio</h3>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.audio.echoCancellation}
                onChange={(e) => setAudio({ echoCancellation: e.target.checked })}
              />
              <span>Annulation d’écho</span>
            </label>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.audio.noiseSuppression}
                onChange={(e) => setAudio({ noiseSuppression: e.target.checked })}
              />
              <span>Réduction du bruit</span>
            </label>
            {audioInputDevices.length > 0 && (
              <label style={styles.label}>
                Micro
                <select
                  value={settings.audio.inputDeviceId ?? ''}
                  onChange={(e) => setAudio({ inputDeviceId: e.target.value || null })}
                  style={styles.select}
                >
                  <option value="">Par défaut</option>
                  {audioInputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
              </label>
            )}
            {audioOutputDevices.length > 0 && (
              <label style={styles.label}>
                Haut-parleurs
                <select
                  value={settings.audio.outputDeviceId ?? ''}
                  onChange={(e) => setAudio({ outputDeviceId: e.target.value || null })}
                  style={styles.select}
                >
                  <option value="">Par défaut</option>
                  {audioOutputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
              </label>
            )}
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Apparence</h3>
            <label style={styles.label}>
              Thème
              <select
                value={settings.appearance.theme}
                onChange={(e) => setAppearance({ theme: e.target.value as ThemeOption })}
                style={styles.select}
              >
                {(Object.keys(THEME_LABELS) as ThemeOption[]).map((t) => (
                  <option key={t} value={t}>{THEME_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Disposition vidéo
              <select
                value={settings.appearance.layout}
                onChange={(e) => setAppearance({ layout: e.target.value as LayoutOption })}
                style={styles.select}
              >
                {(Object.keys(LAYOUT_LABELS) as LayoutOption[]).map((l) => (
                  <option key={l} value={l}>{LAYOUT_LABELS[l]}</option>
                ))}
              </select>
            </label>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.appearance.reducedMotion}
                onChange={(e) => setAppearance({ reducedMotion: e.target.checked })}
              />
              <span>Réduire les animations</span>
            </label>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.appearance.joinWithVideoOff}
                onChange={(e) => setAppearance({ joinWithVideoOff: e.target.checked })}
              />
              <span>Rejoindre avec la caméra coupée (mode audio seul)</span>
            </label>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Micro</h3>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.audioBehavior?.pushToTalk ?? false}
                onChange={(e) => update({ audioBehavior: { pushToTalk: e.target.checked } })}
              />
              <span>Push-to-talk (maintenir Espace pour parler)</span>
            </label>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Réseau &amp; contribution</h3>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.network?.contributeToRelay ?? true}
                onChange={(e) => update({ network: { contributeToRelay: e.target.checked } })}
              />
              <span>Contribuer au relais (afficher « Vous contribuez au réseau »)</span>
            </label>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.network?.ecoMode ?? false}
                onChange={(e) => update({ network: { ecoMode: e.target.checked } })}
              />
              <span>Mode éco (réduire bande passante et contribution)</span>
            </label>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.network?.sovereignMode ?? false}
                onChange={(e) => update({ network: { sovereignMode: e.target.checked } })}
              />
              <span>Mode souverain (ne rien enregistrer après la réunion)</span>
            </label>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Notifications</h3>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.notifications.soundOnNewMessage}
                onChange={(e) => setNotifications({ soundOnNewMessage: e.target.checked })}
              />
              <span>Son à l’arrivée d’un nouveau message</span>
            </label>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Raccourcis clavier</h3>
            <ul style={styles.shortcutList}>
              {SHORTCUTS.map(({ key, label }) => (
                <li key={key} style={styles.shortcutItem}>
                  <kbd style={styles.kbd}>{key}</kbd>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 1000,
    animation: 'nodle-fade-in 0.15s ease-out',
  },
  panel: {
    width: 'min(400px, 100vw)',
    maxHeight: '100vh',
    background: 'var(--surface)',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    animation: 'nodle-slide-in 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border)',
  },
  title: { margin: 0, fontSize: '1.25rem', fontWeight: 600 },
  closeBtn: {
    width: 36,
    height: 36,
    fontSize: '1.5rem',
    lineHeight: 1,
    background: 'transparent',
    color: 'var(--text-muted)',
    padding: 0,
    borderRadius: 'var(--radius)',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '1rem 1.25rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    margin: '0 0 0.75rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    marginBottom: '0.75rem',
    fontSize: '0.9rem',
  },
  select: {
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.9rem',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  shortcutList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  shortcutItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.35rem 0',
    fontSize: '0.9rem',
  },
  kbd: {
    padding: '0.2rem 0.5rem',
    fontSize: '0.8rem',
    background: 'var(--surface-hover)',
    borderRadius: 6,
    fontFamily: 'inherit',
  },
};
