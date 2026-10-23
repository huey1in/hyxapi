package billingexpr

// InvalidateCache gives external package tests a cold cache. Production rule
// changes use content-derived keys and do not need a global reset.
func InvalidateCache() {
	cacheMu.Lock()
	cache = make(map[string]*cachedEntry, 64)
	cacheMu.Unlock()
}
