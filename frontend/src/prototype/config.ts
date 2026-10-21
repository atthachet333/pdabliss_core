/**
 * ============================================================================
 *  EP01-PROTOTYPE — DEMO-ONLY ACCESS. NOT AUTHENTICATION.
 * ============================================================================
 *
 * Everything in `src/prototype/` exists only so the owner can review the
 * department workspaces. It is deliberately isolated so it can be deleted in
 * one step when real authentication arrives:
 *
 *   - The demo credentials below are public (they ship in the JS bundle) and
 *     protect nothing but mock UI. There is no backend involvement.
 *   - The "session" is a sessionStorage flag, not a token.
 *   - The workspace switcher is prototype-only. Production behaviour remains:
 *     user signs in → the system opens their assigned department workspace.
 *
 * The prototype is enabled in `npm run dev`. A production build disables it
 * unless VITE_ENABLE_PROTOTYPE=true is set explicitly.
 */

export const PROTOTYPE_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_PROTOTYPE === 'true';

/** Demo-only reviewer account. Not a real credential. */
export const DEMO_ACCOUNT = { username: 'user1', password: 'pass1' } as const;

export const PROTOTYPE_SESSION_KEY = 'pbc.prototype.session';
export const PROTOTYPE_LAST_WORKSPACE_KEY = 'pbc.prototype.lastWorkspace';
