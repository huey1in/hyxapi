import type { ComponentType, InputHTMLAttributes, TextareaHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { Input as LegacyInput, Textarea as LegacyTextarea, Select as LegacySelect, PageShell as LegacyPageShell, SlideOver as LegacySlideOver } from '../../components/ui';
export const Input = LegacyInput as ComponentType<Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> & { onChange: (value: string) => void }>;
export const Select = LegacySelect as ComponentType<{ options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; disabled?: boolean }>;
export const PageShell = LegacyPageShell as ComponentType<PropsWithChildren<{ title: ReactNode; actions?: ReactNode; maxWidth?: string }>>;
export const SlideOver = LegacySlideOver as ComponentType<PropsWithChildren<{ open: boolean; onClose: () => void; title: ReactNode; width?: number; footer?: ReactNode }>>;

export const Textarea = LegacyTextarea as ComponentType<Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & { onChange: (value: string) => void }>;
