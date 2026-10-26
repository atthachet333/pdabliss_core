import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/500.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/ibm-plex-sans-thai/700.css';
import './styles/index.css';

import { startTransition, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Providers } from './app/Providers';
import { createAppRouter } from './app/router';

// EP17: the static HTML already carries this route's head for crawlers. The
// elements usePageMeta owns at runtime (canonical, alternates, robots, locale
// alternates, JSON-LD) are handed over to it, so navigation never duplicates them.
for (const el of document.head.querySelectorAll('[data-prerendered]')) el.remove();

const router = createAppRouter();
const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

// EP20: the page chunk is preloaded, so the first render usually includes the
// whole page. As a transition React renders it in short slices instead of one
// blocking task (measured on a 4× throttled CPU: /en/pricing longest task
// 213 → 131 ms), with no change to first paint.
const app = createRoot(root);
startTransition(() =>
  app.render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  ),
);
