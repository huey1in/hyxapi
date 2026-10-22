/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  resolveLocalizedText,
  type LocalizedTextValue,
} from './localized-text.ts'

import type {
  BillingUsageFieldSchema,
  BillingUsageSchema,
} from '../types.ts'
import {
  type ParsedTaskTier,
  type TaskTierCondition,
} from './billing-expr.ts'
import { formatBillingCondition } from './billing-expression/condition-display.ts'
import { compileBillingExpression } from './billing-expression/parser.ts'
import { visitExpression } from './billing-expression/types.ts'

function taskPriceLabel(
  description: LocalizedTextValue | undefined,
  field: string,
  language: string
): string {
  const localized =
    typeof description === 'object' && description
      ? { ...description, en: description.en?.trim() || field }
      : description
  return resolveLocalizedText(localized, language) || field
}

function taskEnumLabel(
  definition: BillingUsageFieldSchema | undefined,
  value: string,
  language: string
): string {
  return taskPriceLabel(definition?.enumLabels?.[value], value, language)
}

function taskPricingConditions(
  conditions: TaskTierCondition[],
  schema: BillingUsageSchema | undefined,
  language: string,
  t: (key: string) => string
): string {
  return conditions
    .map(({ field, value }) => {
      const definition = schema?.[field]
      const label = taskPriceLabel(definition?.description, field, language)
      if (definition?.type === 'boolean') {
        return `${label}: ${value === 'true' ? t('Yes') : t('No')}`
      }
      const optionLabel = taskEnumLabel(definition, value, language)
      return optionLabel !== value ? optionLabel : `${label}: ${optionLabel}`
    })
    .join(' · ')
}

export function taskTierConditions(
  tier: ParsedTaskTier,
  schema: BillingUsageSchema | undefined,
  language: string,
  t: (key: string) => string
): string {
  const usage = taskPricingConditions(tier.conditions, schema, language, t)
  const time = tier.conditionText
    ? (formatBillingCondition(tier.conditionText, t, language) ??
      tier.conditionText)
    : ''
  return [usage, time].filter(Boolean).join(' · ')
}

export function pricingDisplayFallbackKey(
  expression: string,
  schema: BillingUsageSchema | null | undefined
): string {
  const compiled = compileBillingExpression(expression)
  let missingUsageMetadata = false
  if (compiled.status === 'ready') {
    visitExpression(compiled.ast, (node) => {
      if (node.kind !== 'call' || node.name !== 'u') return
      const key = node.args[0]
      if (
        !schema ||
        key.kind !== 'literal' ||
        typeof key.value !== 'string' ||
        !Object.hasOwn(schema, key.value)
      ) {
        missingUsageMetadata = true
      }
    })
  }
  return missingUsageMetadata
    ? 'Task usage metadata is unavailable. Pricing details cannot be displayed.'
    : 'This expression cannot be expanded into a price table. View the original expression below.'
}
