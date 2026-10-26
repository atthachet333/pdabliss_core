import type { Quality } from './types';

/*
 * Adaptive quality. Decided once before WebGL loads (cheap capability probe),
 * then lowered at runtime if frames are slow (see PerformanceGuard in
 * CoreWorld). Never raised at runtime — stability over spectacle.
 */

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Returns the GPU renderer string, '' when hidden, or null when WebGL is unavailable. */
export function probeWebGL(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return renderer;
  } catch {
    return null;
  }
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render/i;

export function detectQuality(renderer: string | null = probeWebGL()): Quality {
  if (renderer === null) return 'static';
  if (SOFTWARE_GPU.test(renderer)) return 'static';
  if (prefersReducedMotion()) return 'reduced';

  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 768;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;

  if (coarse || narrow || cores <= 4 || memory <= 4) return 'low';
  if (cores >= 8 && memory >= 8 && !/intel/i.test(renderer)) return 'high';
  return 'medium';
}

let probed: string | null | undefined;

/**
 * detectQuality for the CORE stage. The GPU probe (a throwaway WebGL context)
 * runs once per page session, not on every return to the homepage (EP20);
 * the motion preference and viewport are still read each time.
 */
export function stageQuality(): Quality {
  if (probed === undefined) probed = probeWebGL();
  return detectQuality(probed);
}

/** One step down: used when the runtime frame guard sees sustained slow frames. */
export function lowerQuality(q: Quality): Quality {
  if (q === 'high') return 'medium';
  if (q === 'medium') return 'low';
  return q;
}
