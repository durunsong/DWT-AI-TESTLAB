/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_BRAND_NAME?: string;
  readonly VITE_APP_PRODUCT_NAME?: string;
  readonly VITE_APP_CONTEXT_BODY_LIMIT_MB?: string;
  readonly VITE_APP_UPLOAD_MAX_MB?: string;
  readonly VITE_APP_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_APP_STORAGE_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  readonly dwtDesktop?: {
    readonly platform: string;
    readonly versions: {
      readonly chrome: string;
      readonly electron: string;
      readonly node: string;
    };
  };
}
