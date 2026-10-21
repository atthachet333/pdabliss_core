/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SITE_URL?: string;
  /** EP01-PROTOTYPE: set to "true" to include the demo workspace review in a production build. */
  readonly VITE_ENABLE_PROTOTYPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
