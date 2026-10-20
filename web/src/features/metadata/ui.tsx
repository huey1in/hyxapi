import type { ComponentType, InputHTMLAttributes, TextareaHTMLAttributes, PropsWithChildren, ReactNode, ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Input as LegacyInput, Textarea as LegacyTextarea, Select as LegacySelect, PageShell as LegacyPageShell, SlideOver as LegacySlideOver, Table as LegacyTable, Checkbox as LegacyCheckbox, IconButton as LegacyIconButton, Loading as LegacyLoading, Tag as LegacyTag } from '../../components/ui';
export { Button, Pagination } from '../../components/ui';
export const IconButton = LegacyIconButton as ComponentType<ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon }>;
export const Loading = LegacyLoading as ComponentType<{ label?: string }>;
export const Tag = LegacyTag as ComponentType<PropsWithChildren<{ color?: string }>>;
export const Input = LegacyInput as ComponentType<Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> & { onChange: (value: string) => void; width?: string }>;
export const Textarea = LegacyTextarea as ComponentType<Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & { onChange: (value: string) => void; width?: string }>;
export const Select = LegacySelect as ComponentType<{ options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; disabled?: boolean; width?: string }>;
export const PageShell = LegacyPageShell as ComponentType<PropsWithChildren<{ title: ReactNode; actions?: ReactNode }>>;
export const SlideOver = LegacySlideOver as ComponentType<PropsWithChildren<{ open: boolean; onClose: () => void; title: ReactNode; width?: number; footer?: ReactNode }>>;
export const Checkbox = LegacyCheckbox as ComponentType<{ checked: boolean; onChange: (value: boolean) => void; label?: string; 'aria-label'?: string; disabled?: boolean }>;
type Column<T> = { key: string; title: ReactNode; render?: (row: T) => ReactNode; width?: number; align?: 'left' | 'right' };
export const Table = LegacyTable as <T>(props: { columns: Column<T>[]; rows: T[]; rowKey?: string | ((row: T) => string | number); minWidth?: number }) => ReactNode;
export function ErrorMessage({ message }: { message: string }) { return message ? <p role='alert' className='break-words text-sm text-ui-danger'>{message}</p> : null; }
export function Field({ label, children }: PropsWithChildren<{ label: string }>) { return <div className='min-w-0 space-y-2'><p className='text-sm font-medium text-ui-text'>{label}</p>{children}</div>; }
