import { useId } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { CheckSquare, MinusSquare, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../tokens';

interface TableSelectionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'children'> {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  count?: number;
}

export default function TableSelection({ checked, indeterminate = false, onChange, disabled = false, label, count = 0, id, 'aria-label': ariaLabel, ...rest }: TableSelectionProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const { t } = useTranslation();
  const Icon = indeterminate ? MinusSquare : checked ? CheckSquare : Square;
  const control = <button
    {...rest}
    id={controlId}
    type='button'
    role='checkbox'
    aria-label={ariaLabel ?? label}
    aria-checked={indeterminate ? 'mixed' : checked}
    disabled={disabled}
    onClick={() => onChange(indeterminate || !checked)}
    className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ui-text-2 hover:bg-ui-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-text disabled:cursor-not-allowed disabled:opacity-50 md:h-4 md:w-4')}
  ><Icon size={16} /></button>;

  if (!label) return control;
  return <div className='flex min-h-10 min-w-0 items-center gap-2'>
    {control}
    <div className='min-w-0'>
      <label htmlFor={controlId} className={cn('inline-block py-2 text-ui-text-2', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>{label}</label>
      {count > 0 && <span className='ml-2 inline-block whitespace-nowrap text-xs text-ui-text-3'>{t('已选')} {count} {t('项')}</span>}
    </div>
  </div>;
}
