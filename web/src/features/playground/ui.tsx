import type { ComponentType, InputHTMLAttributes, TextareaHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { Input as LegacyInput, Textarea as LegacyTextarea, Select as LegacySelect, Combobox as LegacyCombobox, PageShell as LegacyPageShell } from '../../components/ui';

type TextChange = { onChange: (value: string) => void };
export const Input = LegacyInput as ComponentType<Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> & TextChange>;
export const Textarea = LegacyTextarea as ComponentType<Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & TextChange>;
type SelectorProps = TextChange & {
  options: { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
};
export const Select = LegacySelect as ComponentType<SelectorProps>;
export const Combobox = LegacyCombobox as ComponentType<SelectorProps>;
export const PageShell = LegacyPageShell as ComponentType<PropsWithChildren<{ title: ReactNode; actions?: ReactNode; maxWidth?: string }>>;
