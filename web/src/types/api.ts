export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface User {
  id: number;
  username: string;
  display_name?: string;
  role: number;
  status?: number;
  email?: string;
  group?: string;
  quota?: number;
  used_quota?: number;
  request_count?: number;
  setting?: string;
}

export interface OAuthProvider {
  slug: string;
  client_id: string;
  authorization_endpoint: string;
  scopes?: string;
}

export interface SiteStatus {
  version?: string;
  start_time?: number;
  setup?: boolean;
  custom_oauth_providers?: OAuthProvider[];
  [key: string]: unknown;
}
