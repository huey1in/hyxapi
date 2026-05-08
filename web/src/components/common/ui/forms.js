/*
Copyright (C) 2025 QuantumNous

Shared form-input class names — keep auth + admin form inputs visually
consistent without duplicating ~80 chars of Tailwind classes in every
file.
*/

// Auth-form input (rounded-lg + focus ring) used by LoginForm,
// RegisterForm, PasswordResetForm.
export const AUTH_INPUT_CLS =
  'w-full px-4 py-2.5 text-sm border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-ui-accent bg-transparent text-ui-text placeholder:text-ui-text-3';

// Admin / modal form input (rounded-xl, no ring) used by Token,
// PersonalSetting, SearchModal etc.
export const INPUT_CLS =
  'w-full px-3 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text outline-none focus:border-ui-text-3 transition-colors';
