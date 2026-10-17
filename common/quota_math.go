package common

import (
	"fmt"
	"math"
)

// Quota conversions are centralized here so every billing path shares one
// saturation + logging policy. Quota columns (user/token/log) are 32-bit
// integers in the database, so an oversized product must clamp to the int32
// range instead of wrapping around and turning a charge into a credit.
const (
	MaxQuota = math.MaxInt32
	MinQuota = math.MinInt32
)

// QuotaClampKind identifies why a quota conversion had to be saturated.
type QuotaClampKind string

// Clamp kinds reported by QuotaClamp.Kind.
const (
	QuotaClampOverflow  QuotaClampKind = "overflow"
	QuotaClampUnderflow QuotaClampKind = "underflow"
	QuotaClampNaN       QuotaClampKind = "nan"
)

// QuotaClamp describes a single saturation event: a quota conversion whose
// input fell outside the representable int32 range (or was NaN) and was
// therefore clamped. It is surfaced to billing callers so the event can be
// recorded on the related consume/task log for admin auditing.
type QuotaClamp struct {
	Op       string         `json:"op"`       // "QuotaFromFloat" | "QuotaRound" | "QuotaFromDecimal"
	Kind     QuotaClampKind `json:"kind"`     // "overflow" | "underflow" | "nan"
	Original float64        `json:"original"` // best-effort pre-clamp value (decimal -> float64 approx)
	Clamped  int            `json:"clamped"`  // the saturated result actually used
}

// Error lets the same typed value serve both as the settlement audit marker
// and as the fail-fast error returned by strict pre-consume conversions.
func (c *QuotaClamp) Error() string {
	if c == nil {
		return ""
	}
	return fmt.Sprintf("quota conversion (%s) %s: original=%g, clamped=%d", c.Op, c.Kind, c.Original, c.Clamped)
}

// saturateQuota converts an already-rounded quota value to int, clamping to
// the int32 range. Whenever clamping (what would otherwise be an integer
// wraparound) or a NaN fallback is triggered it logs a warning, because in
// normal operation a single request never approaches these bounds — hitting
// them signals a bug or an abusive request. `op` names the caller. When a
// clamp occurs it returns a non-nil *QuotaClamp so callers can additionally
// record the event (e.g. on the consume log); the returned pointer is nil for
// in-range values.
func saturateQuota(value float64, op string) (int, *QuotaClamp) {
	var clamp *QuotaClamp
	switch {
	case math.IsNaN(value):
		clamp = &QuotaClamp{Op: op, Kind: QuotaClampNaN, Original: value, Clamped: 0}
	case value >= MaxQuota:
		clamp = &QuotaClamp{Op: op, Kind: QuotaClampOverflow, Original: value, Clamped: MaxQuota}
	case value <= MinQuota:
		clamp = &QuotaClamp{Op: op, Kind: QuotaClampUnderflow, Original: value, Clamped: MinQuota}
	default:
		return int(value), nil
	}
	SysError(clamp.Error())
	return clamp.Clamped, clamp
}

// QuotaFromFloat converts a computed quota value to int, truncating toward
// zero, with saturation. Use for float products of prices, ratios, and
// user-controlled multipliers (image n, video seconds, resolution ratios).
func QuotaFromFloat(value float64) int {
	quota, _ := QuotaFromFloatChecked(value)
	return quota
}

// QuotaFromFloatChecked is QuotaFromFloat but also returns a non-nil
// *QuotaClamp when the value was clamped, so billing callers can audit it.
func QuotaFromFloatChecked(value float64) (int, *QuotaClamp) {
	return saturateQuota(value, "QuotaFromFloat")
}

// QuotaRound converts a float64 quota value to int using half-away-from-zero
// rounding, with saturation. Every tiered billing path (pre-consume,
// settlement, breakdown validation, log fields) MUST use this to avoid +-1
// discrepancies.
func QuotaRound(value float64) int {
	quota, _ := QuotaRoundChecked(value)
	return quota
}

// QuotaRoundChecked is QuotaRound but also returns a non-nil *QuotaClamp when
// the value was clamped, so billing callers can audit it.
func QuotaRoundChecked(value float64) (int, *QuotaClamp) {
	return saturateQuota(math.Round(value), "QuotaRound")
}
