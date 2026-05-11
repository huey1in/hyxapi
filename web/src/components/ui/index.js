/*
 * UI 设计系统统一入口
 *
 * 所有业务代码应该从这里导入组件：
 *   import { Button, Input, Tag, Card } from '@/components/ui';
 *
 * 不要再从 common/form/Primitives、common/ui/Dropdown 等旧路径导入。
 */

export { default as Button } from './Button';
export { default as IconButton } from './IconButton';

export { default as Input } from './Input';
export { default as Textarea } from './Textarea';
export { default as NumberInput } from './NumberInput';

export { default as Select } from './Select';
export { default as Combobox } from './Combobox';
export { default as MultiSelect } from './MultiSelect';
export { default as Dropdown } from './Dropdown';

export { default as Toggle } from './Toggle';
export { default as Checkbox } from './Checkbox';
export { default as Radio, RadioGroup } from './Radio';

export { default as Tag } from './Tag';
export { default as Card } from './Card';

export { default as Modal } from './Modal';
export { default as ConfirmDialog, showConfirm } from './ConfirmDialog';
export { default as SlideOver } from './SlideOver';

export { default as Tabs } from './Tabs';
export { default as Pagination } from './Pagination';
export { default as Loading } from './Loading';
export { default as Skeleton } from './Skeleton';
export { default as Tooltip } from './Tooltip';

// 设计 token（仅当需要在自定义场景中复用 token 时引用）
export * as tokens from './tokens';
