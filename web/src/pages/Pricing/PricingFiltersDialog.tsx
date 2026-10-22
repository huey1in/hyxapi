import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button, IconButton, ModalShell, Select } from '../../components/ui';
import type { SelectOption } from '../../components/ui/select/Select';
import { pricingSorts } from '../../features/pricing/catalog-data';
import type { PricingSort } from '../../features/pricing/catalog-data';
import type { TokenUnit } from '../../features/pricing/types';

export interface PricingFilterValues {
  group: string;
  billing: string;
  vendor: string;
  sort: PricingSort;
  tokenUnit: TokenUnit;
  priceBasis: 'standard' | 'recharge';
}

interface Props {
  initialValues: PricingFilterValues;
  groupOptions: SelectOption<string>[];
  vendorOptions: SelectOption<string>[];
  onApply: (values: PricingFilterValues) => void;
  onClose: () => void;
}

export default function PricingFiltersDialog({ initialValues, groupOptions, vendorOptions, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const dialog = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState(initialValues);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.getElementById(`${id}-group`)?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [id]);

  const field = <K extends keyof PricingFilterValues>(key: K, label: string, options: SelectOption<PricingFilterValues[K]>[]) => (
    <div className='min-w-0 space-y-1.5'>
      <label htmlFor={`${id}-${key}`} className='block text-xs text-ui-text-3'>{t(label)}</label>
      <Select id={`${id}-${key}`} aria-label={t(label)} width='full' value={draft[key]} options={options} popover onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))} />
    </div>
  );

  return <ModalShell open onClose={onClose} maxWidth={480}>
    <form ref={dialog} role='dialog' aria-modal='true' aria-labelledby={`${id}-title`} className='flex max-h-[calc(100dvh-32px)] flex-col' onSubmit={(event) => { event.preventDefault(); onApply(draft); }} onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const items = [...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className='flex shrink-0 items-center justify-between px-6 pt-5 pb-3'>
        <h2 id={`${id}-title`} className='text-base font-semibold text-ui-text'>{t('Filters')}</h2>
        <IconButton icon={X} aria-label={t('Close')} onClick={onClose} />
      </header>
      <div className='min-h-0 overflow-y-auto overscroll-contain px-6 py-3 ui-scrollbar'>
        <div className='grid grid-cols-1 gap-4 min-[480px]:grid-cols-2'>
          {field('group', 'Group', groupOptions)}
          {field('billing', 'Billing type', [{ value: 'all', label: t('All billing types') }, { value: 'tokens', label: t('Pay as you go') }, { value: 'request', label: t('Pay per request') }, { value: 'expression', label: t('Expression billing') }, { value: 'task', label: t('Task billing') }])}
          {field('vendor', 'Vendor', vendorOptions)}
          {field('sort', 'Sort models', pricingSorts.map((item) => ({ value: item.value, label: t(item.label) })))}
          {field('tokenUnit', 'Token price unit', [{ value: 'M', label: t('Per 1M tokens') }, { value: 'K', label: t('Per 1K tokens') }])}
          {field('priceBasis', 'Price basis', [{ value: 'standard', label: t('Standard price') }, { value: 'recharge', label: t('Recharge price') }])}
        </div>
      </div>
      <footer className='flex shrink-0 flex-wrap items-center justify-end gap-2 px-6 pt-3 pb-5'>
        <Button variant='toggle' onClick={onClose}>{t('Cancel')}</Button>
        <Button type='submit'>{t('Apply')}</Button>
      </footer>
    </form>
  </ModalShell>;
}
