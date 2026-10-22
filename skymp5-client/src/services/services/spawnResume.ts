/** A loading destination is client-only. Never send staging state to the server. */
let held = false;

export const isSpawnResumeHeld = () => held;
export const setSpawnResumeHeld = (value: boolean) => { held = value; };

export interface SpawnDestination {
  worldOrCell: number;
  pos: number[];
  rot: number[];
}

export const SPAWN_HORIZONTAL_TOLERANCE = 16;
export const SPAWN_VERTICAL_TOLERANCE = 64;
export const SPAWN_ROTATION_TOLERANCE = 2;

export const SPAWN_RECOVERY_HORIZONTAL_TOLERANCE = 32;
export const SPAWN_RECOVERY_VERTICAL_TOLERANCE = 96;
export const SPAWN_RECOVERY_ROTATION_TOLERANCE = 10;
export const MAX_SPAWN_RELOCATION_ATTEMPTS = 50;

export function validSpawnDestination(value: SpawnDestination): boolean {
  return !!value && Number.isInteger(value.worldOrCell) && value.worldOrCell > 0 &&
    value.worldOrCell <= 0xffffffff && [value.pos, value.rot].every(vector =>
      Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite));
}

export function sameSpawnDestination(a: SpawnDestination, b: SpawnDestination): boolean {
  return a.worldOrCell === b.worldOrCell && a.pos.every((n, i) => n === b.pos[i]) &&
    a.rot.every((n, i) => n === b.rot[i]);
}

export function matchesSpawnPosition(
  actual: SpawnDestination,
  target: SpawnDestination,
  horizontalTolerance = SPAWN_HORIZONTAL_TOLERANCE,
  verticalTolerance = SPAWN_VERTICAL_TOLERANCE
): boolean {
  if (!validSpawnDestination(actual) || !validSpawnDestination(target)) return false;
  if (actual.worldOrCell !== target.worldOrCell) return false;
  const horizontalDist = Math.hypot(actual.pos[0] - target.pos[0], actual.pos[1] - target.pos[1]);
  const verticalDist = Math.abs(actual.pos[2] - target.pos[2]);
  return horizontalDist <= horizontalTolerance && verticalDist <= verticalTolerance;
}

export function matchesSpawnDestination(
  actual: SpawnDestination,
  target: SpawnDestination,
  horizontalTolerance = SPAWN_HORIZONTAL_TOLERANCE,
  verticalTolerance = SPAWN_VERTICAL_TOLERANCE,
  rotationTolerance = SPAWN_ROTATION_TOLERANCE
): boolean {
  const angleDifference = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
  // The native player/camera normalizes pitch and roll after loading. They are
  // not persistence readiness conditions; requiring them can lock the player.
  return matchesSpawnPosition(actual, target, horizontalTolerance, verticalTolerance) &&
    angleDifference(actual.rot[2], target.rot[2]) <= rotationTolerance;
}

export function isVerifiedSafeSpawn(
  actual: SpawnDestination | undefined,
  target: SpawnDestination,
  horizontalTolerance = SPAWN_RECOVERY_HORIZONTAL_TOLERANCE,
  verticalTolerance = SPAWN_RECOVERY_VERTICAL_TOLERANCE
): boolean {
  if (!actual || !validSpawnDestination(actual) || !validSpawnDestination(target)) return false;
  if (actual.worldOrCell !== target.worldOrCell) return false;
  const horizontalDist = Math.hypot(actual.pos[0] - target.pos[0], actual.pos[1] - target.pos[1]);
  const verticalDist = Math.abs(actual.pos[2] - target.pos[2]);
  return horizontalDist <= horizontalTolerance && verticalDist <= verticalTolerance;
}

export function canSendDuringSpawnResume(message: { t: number; contentJsonDump?: string }): boolean {
  if (!held) return true;
  if (message.t !== 1 || typeof message.contentJsonDump !== 'string') return false;
  try {
    return JSON.parse(message.contentJsonDump).customPacketType === 'loginWithSkympIo';
  } catch (_) {
    return false;
  }
}
