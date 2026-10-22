import { createContext } from 'react';

export type EditorCache = Map<string, { value: unknown; invalid: boolean }>;
export const SettingsDraftContext = createContext<{
  cache: EditorCache;
  changed: () => void;
} | null>(null);
