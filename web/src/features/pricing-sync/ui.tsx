import type { ComponentType, ReactNode, InputHTMLAttributes } from 'react';
import { Input as LegacyInput, ConfirmDialog as LegacyConfirmDialog, Checkbox as LegacyCheckbox } from '../../components/ui';
export { Button, Pagination } from '../../components/ui';
export const Input = LegacyInput as ComponentType<Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> & { onChange: (value: string) => void; width?: string }>;
export { default as SlideOver } from '../../components/ui/modal/SlideOver';
export const Checkbox = LegacyCheckbox as ComponentType<{ checked: boolean; onChange: (value: boolean) => void; label?: string; disabled?: boolean }>;
export const ConfirmDialog = LegacyConfirmDialog as ComponentType<{ open: boolean; onClose: () => void; title: string; description?: ReactNode; onConfirm: () => void; confirmText?: string; closeOnConfirm?: boolean; loading?: boolean }>;
