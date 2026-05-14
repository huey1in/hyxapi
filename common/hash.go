package common

import (
	"crypto/sha1"
	"encoding/hex"
)

func Sha1Raw(data []byte) []byte {
	h := sha1.New()
	h.Write(data)
	return h.Sum(nil)
}

func Sha1(data []byte) string {
	return hex.EncodeToString(Sha1Raw(data))
}
