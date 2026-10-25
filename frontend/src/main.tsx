import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/500.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/ibm-plex-sans-thai/700.css';
import './styles/index.css';

import { StrictMode } from 'react';
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

createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
