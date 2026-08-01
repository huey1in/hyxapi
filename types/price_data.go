package types

import "fmt"

type GroupRatioInfo struct {
	GroupRatio float64
}

type PriceData struct {
	FreeModel bool
	// BillingType identifies the direct model price schedule: 0 bills by
	// token and 1 bills once per request. Token prices below are USD per
	// million tokens; RequestPrice is USD per request. GroupRatioInfo is
	// applied by the billing formulas at settlement time.
	BillingType      int
	InputPrice       float64
	OutputPrice      float64
	CacheReadPrice   float64
	CacheWritePrice  float64
	ImagePrice       float64
	AudioInputPrice  float64
	AudioOutputPrice float64
	RequestPrice     float64
	Configured       bool

	OtherRatios       map[string]float64
	Quota             int // 按次计费的最终额度（MJ / Task）
	QuotaToPreConsume int // 按量计费的预消耗额度
	GroupRatioInfo    GroupRatioInfo
}

func (p *PriceData) AddOtherRatio(key string, ratio float64) {
	if p.OtherRatios == nil {
		p.OtherRatios = make(map[string]float64)
	}
	if ratio <= 0 {
		return
	}
	p.OtherRatios[key] = ratio
}

func (p *PriceData) ToSetting() string {
	return fmt.Sprintf("BillingType: %d, InputPrice: %f, OutputPrice: %f, CacheReadPrice: %f, CacheWritePrice: %f, ImagePrice: %f, AudioInputPrice: %f, AudioOutputPrice: %f, RequestPrice: %f, GroupRatio: %f, QuotaToPreConsume: %d", p.BillingType, p.InputPrice, p.OutputPrice, p.CacheReadPrice, p.CacheWritePrice, p.ImagePrice, p.AudioInputPrice, p.AudioOutputPrice, p.RequestPrice, p.GroupRatioInfo.GroupRatio, p.QuotaToPreConsume)
}
