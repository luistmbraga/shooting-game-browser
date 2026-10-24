export const ROAD_HALF = 4;
export const PX_PER_UNIT = 44;

export function laneCenter(state) {
  return (state.lane.left + state.lane.right) * 0.5;
}

export function laneWidthPx(state) {
  return state.lane.right - state.lane.left;
}

/** Game pixel X → world X. Negated because the camera looks down +Z, which flips left and right. */
export function pxToWorldX(px, state) {
  const w = laneWidthPx(state);
  return -((px - laneCenter(state)) / (w * 0.5)) * ROAD_HALF;
}

export function fracToWorldX(frac, state) {
  const px = state.lane.left + frac * laneWidthPx(state);
  return pxToWorldX(px, state);
}

/** Distance ahead of the player in game pixels → world +Z. */
export function gameZToWorld(z) {
  return z / PX_PER_UNIT;
}

/** Formation offset in pixels → world X/Z on the road plane. */
export function formationOffsetWorld(dx, dy, state) {
  const w = laneWidthPx(state);
  const sx = -((dx / (w * 0.5)) * ROAD_HALF);
  const sz = (-dy / PX_PER_UNIT) * 0.85;
  return { x: sx, z: sz };
}
