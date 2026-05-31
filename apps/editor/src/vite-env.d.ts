/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROOFING_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
