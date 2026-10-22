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
import type { TokenVariable } from './billing-expression/types.ts'

// ---------------------------------------------------------------------------
// Local cost evaluator (for the estimator preview)
// ---------------------------------------------------------------------------

const ESTIMATOR_VARS = [
  { var: 'cr', stateKey: 'cacheReadTokens' },
  { var: 'cc', stateKey: 'cacheCreateTokens' },
  { var: 'cc1h', stateKey: 'cacheCreate1hTokens' },
  { var: 'img', stateKey: 'imageTokens' },
  { var: 'img_cr', stateKey: 'imageCacheTokens' },
  { var: 'img_o', stateKey: 'imageOutputTokens' },
  { var: 'ai', stateKey: 'audioInputTokens' },
  { var: 'ao', stateKey: 'audioOutputTokens' },
] as const

export type ExtraTokenValues = Record<
  (typeof ESTIMATOR_VARS)[number]['stateKey'],
  number
>

export function buildEstimatorTokens(
  promptTokens: number,
  completionTokens: number,
  extraTokenValues: ExtraTokenValues
): Partial<Record<TokenVariable, number>> {
  return {
    p: promptTokens,
    c: completionTokens,
    len:
      promptTokens +
      extraTokenValues.cacheReadTokens +
      extraTokenValues.imageCacheTokens +
      extraTokenValues.imageTokens +
      extraTokenValues.audioInputTokens +
      extraTokenValues.cacheCreateTokens +
      extraTokenValues.cacheCreate1hTokens,
    ...Object.fromEntries(
      ESTIMATOR_VARS.map((field) => [
        field.var,
        extraTokenValues[field.stateKey],
      ])
    ),
  }
}
