/**
 * ============================================================================
 *  PROTOTYPE WORKSPACES — SAMPLE UI FOR SCREEN REVIEW, NOT THE PRODUCT.
 * ============================================================================
 *
 * The department workspaces under /app/* (EP01–EP02) are a design prototype
 * with sample data. Since EP23 they sit behind REAL authentication (a server
 * session from /login) — the old browser-only demo credential is gone — and
 * they are enabled only in `npm run dev` or when a build sets
 * VITE_ENABLE_PROTOTYPE=true. A production build sends /app to the Account
 * Portal instead. The workspace switcher stays review-only.
 */

export const PROTOTYPE_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_PROTOTYPE === 'true';

export const PROTOTYPE_LAST_WORKSPACE_KEY = 'pbc.prototype.lastWorkspace';
