export { Button, Pagination, TableSelection, FormField as Field, IconButton, Tag, Input, Textarea, Select, PageShell, Checkbox, Table } from '../../components/ui';
export { default as SlideOver } from '../../components/ui/modal/SlideOver';

export function ErrorMessage({ message }: { message: string }) { return message ? <p role='alert' className='break-words text-sm text-ui-danger'>{message}</p> : null; }
