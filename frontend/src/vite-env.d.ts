/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Render API base URL, e.g. https://algotrace-api.onrender.com (no trailing slash) */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
