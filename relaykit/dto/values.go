package dto

import (
	"strconv"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

type IntValue int

func (i *IntValue) UnmarshalJSON(b []byte) error {
	var n int
	if err := kitutil.Unmarshal(b, &n); err == nil {
		*i = IntValue(n)
		return nil
	}
	var f float64
	if err := kitutil.Unmarshal(b, &f); err == nil {
		*i = IntValue(int(f))
		return nil
	}
	var s string
	if err := kitutil.Unmarshal(b, &s); err != nil {
		return err
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return err
	}
	*i = IntValue(v)
	return nil
}

func (i IntValue) MarshalJSON() ([]byte, error) {
	return kitutil.Marshal(int(i))
}
