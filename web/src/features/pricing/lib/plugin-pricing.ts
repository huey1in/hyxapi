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
import type { BillingPluginVariant, PricingModel } from '../types.ts'

export function withPluginPricing(
  model: PricingModel,
  variant: BillingPluginVariant
): PricingModel {
  const perRequest = (model.quota_type ?? (model.billing_type === 'request' ? 1 : 0)) === 1;
  return {
    ...model,
    quota_type: variant.billing_mode === 'ratio' && perRequest ? 1 : 0,
    billing_type: variant.billing_mode === 'ratio' ? (perRequest ? 'request' : 'tokens') : 'expression',
    model_price: model.model_price ?? model.request_price,
    billing_mode: variant.billing_mode ?? 'tiered_expr',
    billing_expr: variant.billing_expr,
    billing_usage_schema: variant.billing_usage_schema,
    billing_usage_examples: variant.billing_usage_examples,
    billing_plugin_variants: undefined,
  }
}
