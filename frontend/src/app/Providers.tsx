import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * App-wide providers. The query client is not here: only the /app/*
 * workspaces fetch, so it lives with their routes (src/app/appRoutes.tsx, EP20).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    // Honour the OS "reduce motion" preference for every Framer Motion animation.
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  );
}
