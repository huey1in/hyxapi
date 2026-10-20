package common

import "math"

var PasswordLoginEncryptionEnabled bool

const (
	DefaultUserSessionActiveLimit           = 50
	DefaultUserSessionIssuanceLimit         = 100
	DefaultUserSessionIssuanceWindowSeconds = 24 * 60 * 60
	DefaultUserSessionRevokedRetentionDays  = 7
	DefaultUserSessionHourlyAlertThreshold  = 5000
)

var (
	UserSessionActiveLimit           = DefaultUserSessionActiveLimit
	UserSessionIssuanceLimit         = DefaultUserSessionIssuanceLimit
	UserSessionIssuanceWindowSeconds = int64(DefaultUserSessionIssuanceWindowSeconds)
	UserSessionRevokedRetentionDays  = DefaultUserSessionRevokedRetentionDays
	UserSessionHourlyAlertThreshold  = DefaultUserSessionHourlyAlertThreshold
)

func initUserSessionSettings() {
	PasswordLoginEncryptionEnabled = GetEnvOrDefaultBool("PASSWORD_LOGIN_ENCRYPTION_ENABLED", false)
	UserSessionActiveLimit = positiveUserSessionEnv("USER_SESSION_ACTIVE_LIMIT", DefaultUserSessionActiveLimit)
	UserSessionIssuanceLimit = positiveUserSessionEnv("USER_SESSION_ISSUANCE_LIMIT", DefaultUserSessionIssuanceLimit)
	UserSessionIssuanceWindowSeconds = int64(positiveUserSessionEnv("USER_SESSION_ISSUANCE_WINDOW_SECONDS", DefaultUserSessionIssuanceWindowSeconds))
	UserSessionRevokedRetentionDays = positiveUserSessionEnv("USER_SESSION_REVOKED_RETENTION_DAYS", DefaultUserSessionRevokedRetentionDays)
	UserSessionHourlyAlertThreshold = positiveUserSessionEnv("USER_SESSION_HOURLY_ALERT_THRESHOLD", DefaultUserSessionHourlyAlertThreshold)

	const secondsPerDay = 24 * 60 * 60
	if int64(UserSessionRevokedRetentionDays) > math.MaxInt64/secondsPerDay {
		SysError(LogText(
			"USER_SESSION_REVOKED_RETENTION_DAYS is too large, using default value: %d",
			DefaultUserSessionRevokedRetentionDays,
		))
		UserSessionRevokedRetentionDays = DefaultUserSessionRevokedRetentionDays
	}
	retentionSeconds := int64(UserSessionRevokedRetentionDays) * secondsPerDay
	if UserSessionIssuanceWindowSeconds > retentionSeconds {
		configuredWindow := UserSessionIssuanceWindowSeconds
		UserSessionIssuanceWindowSeconds = retentionSeconds
		SysError(LogText(
			"USER_SESSION_ISSUANCE_WINDOW_SECONDS exceeds revoked retention; configured_window_seconds=%d revoked_retention_seconds=%d effective_window_seconds=%d",
			configuredWindow,
			retentionSeconds,
			UserSessionIssuanceWindowSeconds,
		))
	}
}

func positiveUserSessionEnv(name string, fallback int) int {
	value := GetEnvOrDefault(name, fallback)
	if value <= 0 {
		SysError(LogText("%s must be positive, using default value: %d", name, fallback))
		return fallback
	}
	return value
}
