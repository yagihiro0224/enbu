export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** フレームレート非依存の減衰補間 */
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const TAU = Math.PI * 2;
/** 角度差を -PI..PI に正規化 */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function dampAngle(a: number, b: number, rate: number, dt: number): number {
  return a + angleDiff(a, b) * (1 - Math.exp(-rate * dt));
}
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInCubic = (t: number) => Math.pow(clamp(t, 0, 1), 3);
export const smoothstep = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
