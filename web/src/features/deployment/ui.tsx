import type { ComponentType, PropsWithChildren, ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Input as LegacyInput, Textarea as LegacyTextarea, Select as LegacySelect, Checkbox as LegacyCheckbox, SlideOver as LegacySlideOver, ConfirmDialog as LegacyConfirmDialog, Table as LegacyTable, PageShell as LegacyPageShell } from '../../components/ui';
export { Button, Pagination } from '../../components/ui';
export const Input = LegacyInput as ComponentType<Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> & { onChange: (value: string) => void; width?: string }>;
export const Textarea = LegacyTextarea as ComponentType<Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & { onChange: (value: string) => void }>;
export const Select = LegacySelect as ComponentType<{ value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; width?: string; disabled?: boolean }>;
export const Checkbox = LegacyCheckbox as ComponentType<{ checked: boolean; onChange: (value: boolean) => void; label?: string; disabled?: boolean }>;
export const PageShell = LegacyPageShell as ComponentType<PropsWithChildren<{ title: string; actions?: ReactNode }>>;
export const SlideOver = LegacySlideOver as ComponentType<PropsWithChildren<{ open: boolean; onClose: () => void; title: string; width?: number; footer?: ReactNode }>>;
export const ConfirmDialog = LegacyConfirmDialog as ComponentType<{ open: boolean; onClose: () => void; title: string; description?: ReactNode; onConfirm: () => void; confirmText?: string; closeOnConfirm?: boolean; loading?: boolean }>;
type Column<T> = { key: string; title: ReactNode; render: (row: T) => ReactNode };
export const Table = LegacyTable as <T>(props: { columns: Column<T>[]; rows: T[]; rowKey?: string; minWidth?: number }) => ReactNode;
export function Field({ label, children }: PropsWithChildren<{ label: string }>) { return <label className='grid min-w-0 gap-1.5 text-sm text-ui-text-2'><span>{label}</span>{children}</label>; }
export function ErrorMessage({ message }: { message: string }) { return message ? <p role='alert' className='break-words text-sm text-ui-danger'>{message}</p> : null; }
