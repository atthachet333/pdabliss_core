import { CanvasTexture, Sprite } from 'three';

/** Shared soft radial sprite texture (64px) for node halos. */
let haloTexture: CanvasTexture | null = null;

export function getHaloTexture() {
  if (haloTexture) return haloTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  haloTexture = new CanvasTexture(c);
  return haloTexture;
}

/**
 * EP21: frees the module-level GPU resources when the scene unmounts — our
 * cached halo texture and the one geometry three.js shares between all sprites.
 * Every renderer that uploads them subscribes to their `dispose` event, and R3F
 * disposes neither, so without this each past renderer (its WebGL context,
 * canvas and the old homepage DOM) stayed reachable: ≈ 300 detached DOM nodes
 * per homepage visit. Both simply upload again on the next visit.
 */
export function releaseSharedResources() {
  haloTexture?.dispose();
  // A throwaway sprite hands back three.js's shared sprite geometry.
  const probe = new Sprite();
  probe.geometry.dispose();
  probe.material.dispose();
}
