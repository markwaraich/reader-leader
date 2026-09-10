/** Pure VAD helpers keep signal calibration testable and separate from React/browser resources. */
export const VAD_CALIBRATION_MS = 600;
export const VAD_MIN_THRESHOLD = 0.018;
export const VAD_MAX_THRESHOLD = 0.08;
export const VAD_NOISE_MULTIPLIER = 2.8;
export const VAD_RELEASE_RATIO = 0.72;

export function calculateRms(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  let energy = 0;
  for (const value of samples) {
    const normalized = (value - 128) / 128;
    energy += normalized * normalized;
  }
  return Math.sqrt(energy / samples.length);
}

export function deriveVadThreshold(noiseSamples: number[]): number {
  if (noiseSamples.length === 0) return 0.028;
  const sorted = [...noiseSamples].sort((left, right) => left - right);
  const quietHalf = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  const noiseFloor = quietHalf.reduce((total, value) => total + value, 0) / quietHalf.length;
  return Math.min(VAD_MAX_THRESHOLD, Math.max(VAD_MIN_THRESHOLD, noiseFloor * VAD_NOISE_MULTIPLIER));
}

export function isVoiceActive(rms: number, threshold: number, wasSpeaking: boolean): boolean {
  return rms >= (wasSpeaking ? threshold * VAD_RELEASE_RATIO : threshold);
}
