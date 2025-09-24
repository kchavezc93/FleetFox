// Minimal ambient types for process.env to satisfy strict TS without @types/node
// This file can be removed once @types/node is properly installed and recognized.

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_COMPANY_NAME?: string;
    NEXT_PUBLIC_COMPANY_LOGO_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
