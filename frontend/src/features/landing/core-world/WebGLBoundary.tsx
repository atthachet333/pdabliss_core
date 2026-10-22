import { Component, type ReactNode } from 'react';

/** Any render/shader error inside the canvas falls back to the static CORE. */
export class WebGLBoundary extends Component<
  { onFail: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn('CORE World: WebGL scene failed, using static fallback.', error);
    this.props.onFail();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
