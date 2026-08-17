import { PART_AREA_BUDGET } from '../shared/constants';

/**
 * How large a single canvas allocation this machine can be trusted with.
 *
 * ShotDock splits a tall capture into parts because one enormous canvas fails on
 * modest hardware — but the threshold that is right for a 2 GB Chromebook wastes
 * most of what a 32 GB desktop can do, and a split image is worse than an unsplit
 * one for the user. So the threshold is measured rather than guessed at.
 *
 * The tier only ever decides *how finely* the output is divided. Total memory is
 * the same either way (see PART_AREA_BUDGET), and the retry ladder in the
 * stitcher still steps down if the machine refuses what its tier promised — so
 * being wrong here costs a retry, never a failed capture.
 */
export type DeviceTier = 'low' | 'medium' | 'high';

/** The subset of `navigator` this decision reads. Passed explicitly in tests. */
export interface DeviceProfile {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export function detectDeviceTier(profile: DeviceProfile = readProfile()): DeviceTier {
  const memory = profile.deviceMemory;
  if (typeof memory === 'number' && memory > 0) {
    if (memory <= 2) return 'low';
    if (memory <= 4) return 'medium';
    return 'high';
  }

  // No deviceMemory: a non-Chromium engine, or a build that hides it. Core count
  // is a poor proxy for RAM, so it is only allowed to argue *down* to 'low' —
  // never up to 'high', which would be gambling with someone else's memory.
  const cores = profile.hardwareConcurrency;
  return typeof cores === 'number' && cores > 0 && cores < 4 ? 'low' : 'medium';
}

/** Pixels one output part may cover on this machine. */
export function partAreaBudget(tier: DeviceTier = currentTier()): number {
  return PART_AREA_BUDGET[tier];
}

let cached: DeviceTier | null = null;

/** The detected tier, worked out once — the hardware does not change mid-session. */
export function currentTier(): DeviceTier {
  return (cached ??= detectDeviceTier());
}

/** Test seam; also lets a future setting override the detected tier. */
export function resetTierCache(): void {
  cached = null;
}

/**
 * `navigator` is absent in some contexts this code is bundled into (and under the
 * node test environment), and `deviceMemory` is absent outside Chromium. Both are
 * ordinary cases, not errors — the caller has a sensible answer for either.
 */
function readProfile(): DeviceProfile {
  if (typeof navigator === 'undefined') return {};
  const source = navigator as Navigator & { deviceMemory?: number };
  return {
    deviceMemory: source.deviceMemory,
    hardwareConcurrency: source.hardwareConcurrency,
  };
}
