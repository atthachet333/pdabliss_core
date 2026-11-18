/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SITE_URL?: string;
  /** EP01-PROTOTYPE: set to "true" to include the demo workspace review in a production build. */
  readonly VITE_ENABLE_PROTOTYPE?: string;
  /** EP48.5 F1: "false" = accounts come from company invitations only (the public build sets it). */
  readonly VITE_PUBLIC_SIGNUP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
