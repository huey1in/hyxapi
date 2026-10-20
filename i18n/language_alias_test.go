package i18n

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTraditionalLanguageAliases(t *testing.T) {
	for _, value := range []string{"zhTW", "zh-TW", "zh_HK", "zh-MO", "zh-Hant", "zh-Hant-HK"} {
		assert.Equal(t, LangZhTW, normalizeLang(value), value)
		assert.Equal(t, LangZhTW, ParseAcceptLanguage(value+",en;q=0.8"), value)
	}
	assert.Equal(t, LangZhCN, normalizeLang("zhCN"))
	assert.Equal(t, LangEn, normalizeLang("fr-CA"))
}
