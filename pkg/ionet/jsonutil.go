package ionet

import (
	"bytes"
	"encoding/json"
	"strings"
	"time"

	"github.com/samber/lo"
)

// decodeWithFlexibleTimes unmarshals API responses while tolerating timestamp strings
// that omit timezone information by normalizing them to RFC3339Nano.
func decodeWithFlexibleTimes(data []byte, target interface{}) error {
	var intermediate interface{}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err := decoder.Decode(&intermediate); err != nil {
		return err
	}

	normalized := normalizeTimeValues(intermediate)
	reencoded, err := json.Marshal(normalized)
	if err != nil {
		return err
	}

	return json.Unmarshal(reencoded, target)
}

func decodeData[T any](data []byte, target *T) error {
	var wrapper struct {
		Data T `json:"data"`
	}
	if err := json.Unmarshal(data, &wrapper); err != nil {
		return err
	}
	*target = wrapper.Data
	return nil
}

func decodeDataWithFlexibleTimes[T any](data []byte, target *T) error {
	var wrapper struct {
		Data T `json:"data"`
	}
	if err := decodeWithFlexibleTimes(data, &wrapper); err != nil {
		return err
	}
	*target = wrapper.Data
	return nil
}

func normalizeTimeValues(value interface{}) interface{} {
	switch v := value.(type) {
	case map[string]interface{}:
		return lo.MapValues(v, func(val interface{}, key string) interface{} {
			if key == "env_variables" || key == "secret_env_variables" {
				return val
			}
			if text, ok := val.(string); ok {
				switch key {
				case "created_at", "updated_at", "started_at", "finished_at", "timestamp", "time":
					if normalized, changed := normalizeTimeString(text); changed {
						return normalized
					}
				}
			}
			return normalizeTimeValues(val)
		})
	case []interface{}:
		return lo.Map(v, func(item interface{}, _ int) interface{} {
			return normalizeTimeValues(item)
		})
	default:
		return value
	}
}

func normalizeTimeString(input string) (string, bool) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return input, false
	}

	if _, err := time.Parse(time.RFC3339Nano, trimmed); err == nil {
		return trimmed, trimmed != input
	}
	if _, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return trimmed, trimmed != input
	}

	layouts := []string{
		"2006-01-02T15:04:05.999999999",
		"2006-01-02T15:04:05.999999",
		"2006-01-02T15:04:05",
	}

	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return parsed.UTC().Format(time.RFC3339Nano), true
		}
	}

	return input, false
}
