/**
 * Construction des contraintes getUserMedia à partir des réglages Nodle.
 * Qualité type Teams/Zoom : presets, frame rate, écho/bruit.
 */

import type { VideoSettings, AudioSettings } from './types';

export function buildVideoConstraints(
  video: VideoSettings,
  remoteCount: number
): MediaTrackConstraints {
  const fr = video.maxFrameRate;
  const adaptive = video.adaptiveQuality && remoteCount > 0;

  let width: number; let height: number;
  if (adaptive && remoteCount >= 12) {
    width = 320; height = 240;
  } else if (adaptive && remoteCount >= 6) {
    width = 640; height = 480;
  } else {
    switch (video.quality) {
      case '1080p': width = 1920; height = 1080; break;
      case '720p': width = 1280; height = 720; break;
      case '480p': width = 854; height = 480; break;
      case '360p': width = 640; height = 360; break;
      case 'data-saver': width = 320; height = 240; break;
      default: width = 1280; height = 720; break; // auto
    }
  }

  const c: MediaTrackConstraints = {
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { max: fr },
  };
  if (video.cameraDeviceId) c.deviceId = { exact: video.cameraDeviceId };
  return c;
}

export function buildAudioConstraints(audio: AudioSettings): MediaTrackConstraints {
  const c: MediaTrackConstraints = {
    echoCancellation: audio.echoCancellation,
    noiseSuppression: audio.noiseSuppression,
  };
  if (audio.inputDeviceId) c.deviceId = { exact: audio.inputDeviceId };
  return c;
}
