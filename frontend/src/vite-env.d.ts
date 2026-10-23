declare namespace NodeJS {
  interface ProcessEnv {
    VITE_API_URL?: string;
  }
}

interface ImportMetaEnv {
  VITE_API_URL?: string;
}
interface ImportMeta {
  env: ImportMetaEnv;
}
