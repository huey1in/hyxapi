/*
 * Form input className shims — kept for backward compat.
 * 新代码请直接用 `import { Input, inputClass } from '@/components/ui'`。
 *
 * 这里只是把全站用过的两套常量重新指向 ui/Input 的 inputClass 工厂，
 * 这样视觉只有一处定义（ui/Input.jsx）。
 */

import { inputClass } from '../../ui';

// Auth-form input — rounded-lg + focus ring
export const AUTH_INPUT_CLS = inputClass({ variant: 'auth', size: 'lg' });

// Admin / modal input — rounded-xl, no ring
export const INPUT_CLS = inputClass({ variant: 'admin', size: 'md' });
