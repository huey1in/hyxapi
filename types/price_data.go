package types

import (
	"fmt"
	"math"

	"github.com/shopspring/decimal"
)

type GroupRatioInfo struct {
	GroupRatio float64
}

type PriceData struct {
	FreeModel bool
	// BillingType identifies the direct model price schedule: 0 bills by
	// token and 1 bills once per request. Token prices below are USD per
	// million tokens; RequestPrice is USD per request. GroupRatioInfo is
	// applied by the billing formulas at settlement time.
	BillingType          int
	InputPrice           float64
	OutputPrice          float64
	CacheReadPrice       float64
	CacheWritePrice      float64
	ImagePrice           float64
	AudioInputPrice      float64
	AudioOutputPrice     float64
	RequestPrice         float64
	Configured           bool
	ModelPrice           float64
	ModelRatio           float64
	CompletionRatio      float64
	CacheRatio           float64
	CacheCreationRatio   float64
	CacheCreation5mRatio float64
	CacheCreation1hRatio float64
	ImageRatio           float64
	AudioRatio           float64
	AudioCompletionRatio float64
	UsePrice             bool

	otherRatios       map[string]float64
	Quota             int // 按次计费的最终额度（MJ / Task）
	QuotaToPreConsume int // 按量计费的预消耗额度
	GroupRatioInfo    GroupRatioInfo
}

func (p *PriceData) ReplaceOtherRatios(ratios map[string]float64) bool {
	p.otherRatios = nil
	for key, ratio := range ratios {
		p.AddOtherRatio(key, ratio)
	}
	return len(p.otherRatios) > 0
}

func (p *PriceData) HasOtherRatio(key string) bool {
	ratio, ok := p.otherRatios[key]
	return ok && ratio > 0 && !math.IsInf(ratio, 1)
}

func (p *PriceData) OtherRatioMultiplier() float64 {
	multiplier := 1.0
	for _, ratio := range p.otherRatios {
		if ratio > 0 && !math.IsInf(ratio, 1) {
			multiplier *= ratio
		}
	}
	return multiplier
}

func (p *PriceData) ApplyOtherRatiosToFloat(value float64) float64 {
	return value * p.OtherRatioMultiplier()
}

func (p *PriceData) ApplyOtherRatiosToDecimal(value decimal.Decimal) decimal.Decimal {
	return value.Mul(decimal.NewFromFloat(p.OtherRatioMultiplier()))
}

func (p *PriceData) RemoveOtherRatiosFromFloat(value float64) float64 {
	multiplier := p.OtherRatioMultiplier()
	if multiplier == 0 {
		return value
	}
	return value / multiplier
}

func (p *PriceData) AddOtherRatio(key string, ratio float64) {
	if p.otherRatios == nil {
		p.otherRatios = make(map[string]float64)
	}
	if ratio <= 0 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
		return
	}
	p.otherRatios[key] = ratio
}

func (p *PriceData) OtherRatios() map[string]float64 {
	if len(p.otherRatios) == 0 {
		return nil
	}
	ratios := make(map[string]float64, len(p.otherRatios))
	for key, ratio := range p.otherRatios {
		ratios[key] = ratio
	}
	return ratios
}

func (p *PriceData) ToSetting() string {
	return fmt.Sprintf("BillingType: %d, InputPrice: %f, OutputPrice: %f, CacheReadPrice: %f, CacheWritePrice: %f, ImagePrice: %f, AudioInputPrice: %f, AudioOutputPrice: %f, RequestPrice: %f, GroupRatio: %f, QuotaToPreConsume: %d", p.BillingType, p.InputPrice, p.OutputPrice, p.CacheReadPrice, p.CacheWritePrice, p.ImagePrice, p.AudioInputPrice, p.AudioOutputPrice, p.RequestPrice, p.GroupRatioInfo.GroupRatio, p.QuotaToPreConsume)
}
