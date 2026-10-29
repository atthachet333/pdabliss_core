import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

/*
 * DEVELOPMENT ONLY (EP28.1) — the demo persona accounts, to prefill the email.
 *
 * Imported by LoginGateway only when `import.meta.env.DEV` (a production build
 * contains none of this code), and shown only when the API lists personas —
 * which it does only where the demo sign-in bypass exists (never production,
 * ENABLE_DEMO_ROUTES on). It never knows or fills a password. English labels:
 * a developer utility, not product copy.
 */

interface Persona {
  key: string;
  label: string;
  email: string;
  jobTitle: string;
}

export default function DevPersonaPicker({ onPick }: { onPick: (email: string) => void }) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<{ personas: Persona[] }>('/api/v1/demo/personas', controller.signal)
      .then((r) => setPersonas(r.personas))
      .catch(() => setPersonas([]));
    return () => controller.abort();
  }, []);
  if (!personas.length) return null;
  return (
    <section
      aria-labelledby="dev-personas-title"
      className="mt-6 rounded-xl p-3 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]"
      data-dev-personas
    >
      <h2 id="dev-personas-title" className="text-caption font-semibold text-warning">
        Demo accounts (development only)
      </h2>
      <p className="mt-1 text-caption text-text-muted">
        Fills the email; the password comes from your local .env.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {personas.map((p) => (
          <li key={p.key}>
            <button
              type="button"
              onClick={() => onPick(p.email)}
              title={`${p.email} — ${p.jobTitle}`}
              aria-label={`Use the ${p.label} demo account (${p.email})`}
              className="min-h-11 rounded-full px-3.5 text-caption text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.18)] hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              data-persona={p.key}
            >
              {p.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
