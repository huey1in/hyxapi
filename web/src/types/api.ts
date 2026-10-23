export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export type User = import('../stores/auth-store').AuthUser;

export interface OAuthProvider {
  id?: number;
  name?: string;
  icon?: string;
  slug: string;
  client_id: string;
  authorization_endpoint: string;
  scopes?: string;
}

export interface SiteStatus {
  version?: string;
  announcements?: { id?: string | number; content?: string; publishDate?: string; type?: string; extra?: string; title?: string; link?: string }[];
  announcements_enabled?: boolean;
  enable_data_export?: boolean;
  start_time?: number;
  setup?: boolean;
  email_verification?: boolean;
  register_enabled?: boolean;
  password_login_enabled?: boolean;
  password_register_enabled?: boolean;
  password_login_encryption_enabled?: boolean;
  github_oauth?: boolean;
  github_client_id?: string;
  google_oauth?: boolean;
  google_redirect_uri?: string;
  discord_oauth?: boolean;
  discord_client_id?: string;
  linuxdo_oauth?: boolean;
  linuxdo_client_id?: string;
  oidc_enabled?: boolean;
  oidc_client_id?: string;
  oidc_display_name?: string;
  oidc_authorization_endpoint?: string;
  telegram_oauth?: boolean;
  wechat_login?: boolean;
  wechat_qrcode?: string;
  turnstile_check?: boolean;
  turnstile_site_key?: string;
  passkey_login?: boolean;
  two_factor_enabled?: boolean;
  user_agreement_enabled?: boolean;
  privacy_policy_enabled?: boolean;
  self_use_mode_enabled?: boolean;
  demo_site_enabled?: boolean;
  invitation_rewards_enabled?: boolean;
  checkin_enabled?: boolean;
  custom_oauth_providers?: OAuthProvider[];
  [key: string]: unknown;
}
