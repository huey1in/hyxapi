declare global {
  interface ImportMetaEnv {
    /** Optional API origin; leave empty for unified-site deployments. */
    readonly PUBLIC_API_BASE_URL?: string;
  }
}

declare module 'axios' {
  interface AxiosRequestConfig {
    skipErrorHandler?: boolean;
    disableDuplicate?: boolean;
  }
}

// Preserve Axios's exports while extending its request configuration.
export {};
