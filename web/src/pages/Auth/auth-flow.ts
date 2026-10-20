import type { LoginChallenge } from '../../features/auth/secure-verification/types';

export function safeAuthRedirect(target: string | null | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(target)) return '/console';
  return target;
}

export function isLoginChallenge(value: unknown): value is LoginChallenge {
  if (!value || typeof value !== 'object') return false;
  const challenge = value as Partial<LoginChallenge>;
  return challenge.require_verification === true && typeof challenge.flow_token === 'string' && !!challenge.flow_token &&
    typeof challenge.expires_at === 'number' && Number.isFinite(challenge.expires_at) && Array.isArray(challenge.methods) && challenge.methods.length > 0;
}

export function registrationPayload(form: { username: string; password: string; confirm: string; email: string; verificationCode: string }, verifyEmail: boolean, affiliate: string) {
  const username = form.username.trim();
  if (!username || Array.from(username).length > 20) throw new Error('Username must contain between 1 and 20 characters');
  const length = Array.from(form.password).length;
  if (length < 8 || length > 128) throw new Error('Password must contain between 8 and 128 characters.');
  if (form.password !== form.confirm) throw new Error('Passwords do not match');
  const email = form.email.trim().toLowerCase();
  const verification_code = form.verificationCode.trim();
  if (verifyEmail && (!email || !verification_code)) throw new Error('Enter your email and verification code');
  return { username, password: form.password, aff_code: affiliate.trim(), ...(verifyEmail ? { email, verification_code } : {}) };
}
