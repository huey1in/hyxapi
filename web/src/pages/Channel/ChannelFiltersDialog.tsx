import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button, FormField, IconButton, Input, ModalShell, Select } from '../../components/ui';
import type { SelectOption } from '../../components/ui/select/Select';
import { CHANNEL_TYPE_OPTIONS } from '../../constants/channel-types';

export interface ChannelFilterValues {
  status: string;
  type: string;
  group: string;
  sort: string;
  direction: string;
}

export const DEFAULT_CHANNEL_FILTERS: ChannelFilterValues = {
  status: 'all', type: 'all', group: '', sort: 'priority', direction: 'desc',
};

interface Props {
  initialValues: ChannelFilterValues;
  onApply: (values: ChannelFilterValues) => void;
  onClose: () => void;
}

export default function ChannelFiltersDialog({ initialValues, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const dialog = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState(initialValues);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.getElementById(`${id}-status`)?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [id]);

  const field = (key: keyof ChannelFilterValues, label: string, options: SelectOption<string>[]) => <FormField label={t(label)}>
    <Select id={`${id}-${key}`} aria-label={t(label)} width='full' value={draft[key]} options={options} popover onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))} />
  </FormField>;

  return <ModalShell open onClose={onClose} maxWidth={480}>
    <form ref={dialog} role='dialog' aria-modal='true' aria-labelledby={`${id}-title`} className='flex max-h-[calc(100dvh-32px)] flex-col' onSubmit={(event) => { event.preventDefault(); onApply(draft); }} onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]') ?? [])].filter((item) => item.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className='flex shrink-0 items-center justify-between px-6 pt-5 pb-3'>
        <h2 id={`${id}-title`} className='text-base font-semibold text-ui-text'>{t('Filters')}</h2>
        <IconButton icon={X} aria-label={t('Close')} onClick={onClose} />
      </header>
      <div className='min-h-0 overflow-y-auto overscroll-contain px-6 py-3 ui-scrollbar'>
        <div className='space-y-4'>
          {field('status', 'Status', [{ value: 'all', label: t('全部状态') }, { value: '1', label: t('启用') }, { value: '2', label: t('禁用') }, { value: '3', label: t('自动禁用') }])}
          {field('type', 'Type', [{ value: 'all', label: t('全部类型') }, ...CHANNEL_TYPE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))])}
          <FormField label={t('Group')}>
            <Input id={`${id}-group`} aria-label={t('Group')} value={draft.group} onChange={(group) => setDraft((current) => ({ ...current, group }))} placeholder={t('按分组筛选')} width='full' />
          </FormField>
          {field('sort', 'Sort channels by', [{ value: 'priority', label: t('按优先级') }, { value: 'id', label: t('按 ID') }, { value: 'name', label: t('按名称') }, { value: 'balance', label: t('按余额') }, { value: 'response_time', label: t('按响应时间') }, { value: 'test_time', label: t('按测试时间') }])}
          {field('direction', 'Sort direction', [{ value: 'desc', label: t('降序') }, { value: 'asc', label: t('升序') }])}
        </div>
      </div>
      <footer className='flex shrink-0 flex-wrap items-center justify-end gap-2 px-6 pt-3 pb-5'>
        <Button variant='toggle' onClick={onClose}>{t('Cancel')}</Button>
        <Button type='submit'>{t('Apply')}</Button>
      </footer>
    </form>
  </ModalShell>;
}
