/*
 * HTTP 状态码规则输入 — token-system rewrite.
 */
import React from 'react';
import {
  FieldRow,
  TextField,
  Chip,
} from '../common/form/Primitives';

export default function HttpStatusCodeRulesInput({
  label,
  value,
  placeholder,
  hint,
  onChange,
  parsed,
  invalidText,
}) {
  const error =
    parsed && !parsed.ok
      ? `${invalidText || ''}${
          parsed.invalidTokens?.length ? `: ${parsed.invalidTokens.join(', ')}` : ''
        }`
      : '';

  return (
    <FieldRow label={label} hint={hint} error={error}>
      <TextField
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
      />
      {parsed?.ok && parsed.tokens?.length > 0 && (
        <div className='flex flex-wrap gap-1.5 mt-2'>
          {parsed.tokens.map((token) => (
            <Chip key={token}>{token}</Chip>
          ))}
        </div>
      )}
    </FieldRow>
  );
}
