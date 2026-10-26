import { Sprite } from 'three';
import { describe, expect, it, vi } from 'vitest';
import coreWorldSource from './CoreWorld.tsx?raw';
import { getHaloTexture, releaseSharedResources } from './halo';

/*
 * EP21: module-level GPU resources kept every past renderer — its WebGL
 * context, canvas and the old homepage DOM — reachable through their
 * `dispose` listeners (≈ 300 detached nodes per homepage visit).
 */
describe('CORE World shared GPU resources', () => {
  it('releases the halo texture and three.js’s shared sprite geometry', () => {
    const texture = getHaloTexture();
    const geometry = new Sprite().geometry;
    const onTexture = vi.fn();
    const onGeometry = vi.fn();
    texture.addEventListener('dispose', onTexture);
    geometry.addEventListener('dispose', onGeometry);

    releaseSharedResources();

    expect(onTexture).toHaveBeenCalledOnce();
    expect(onGeometry).toHaveBeenCalledOnce();
    // The cached texture stays usable for the next visit.
    expect(getHaloTexture()).toBe(texture);
  });

  it('releases them whenever the scene unmounts', () => {
    expect(coreWorldSource).toMatch(/useEffect\(\(\) => releaseSharedResources, \[\]\)/);
  });
});
