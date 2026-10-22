package i18n

const MsgTokenStatusUnavailable = "token.status_unavailable"
const MsgAuthClientIPUnresolved = "auth.client_ip_unresolved"
const MsgAuthTokenIPNotAllowed = "auth.token_ip_not_allowed"

// Message keys for i18n translations
// Use these constants instead of hardcoded strings

// Common error messages
const (
	MsgInvalidParams = "common.invalid_params"
	MsgDatabaseError = "common.database_error"
	MsgBatchTooMany  = "common.batch_too_many"
)

// Auth middleware messages
const (
	MsgAuthUserBanned            = "auth.user_banned"
	MsgAuthInsufficientPrivilege = "auth.insufficient_privilege"
)

// Token related messages
const (
	MsgTokenNameTooLong          = "token.name_too_long"
	MsgTokenQuotaNegative        = "token.quota_negative"
	MsgTokenQuotaExceedMax       = "token.quota_exceed_max"
	MsgTokenGenerateFailed       = "token.generate_failed"
	MsgTokenGetInfoFailed        = "token.get_info_failed"
	MsgTokenExpiredCannotEnable  = "token.expired_cannot_enable"
	MsgTokenExhaustedCannotEable = "token.exhausted_cannot_enable"
	MsgTokenInvalid              = "token.invalid"
	MsgTokenNotProvided          = "token.not_provided"
)

// Redemption related messages
const (
	MsgRedemptionCountPositive     = "redemption.count_positive"
	MsgRedemptionCountMax          = "redemption.count_max"
	MsgRedemptionCreateFailed      = "redemption.create_failed"
	MsgRedemptionExpireTimeInvalid = "redemption.expire_time_invalid"
)

// Distributor related messages
const (
	MsgDistributorInvalidRequest      = "distributor.invalid_request"
	MsgDistributorInvalidChannelId    = "distributor.invalid_channel_id"
	MsgDistributorChannelDisabled     = "distributor.channel_disabled"
	MsgDistributorTokenNoModelAccess  = "distributor.token_no_model_access"
	MsgDistributorTokenModelForbidden = "distributor.token_model_forbidden"
	MsgDistributorModelNameRequired   = "distributor.model_name_required"
	MsgDistributorGetChannelFailed    = "distributor.get_channel_failed"
	MsgDistributorNoAvailableChannel  = "distributor.no_available_channel"
)

const (
	MsgNotifyQuotaLowTitle             = "notify.quota_low_title"
	MsgNotifySubscriptionQuotaLowTitle = "notify.subscription_quota_low_title"
	MsgNotifyQuotaLowBark              = "notify.quota_low_bark"
	MsgNotifyQuotaLowGotify            = "notify.quota_low_gotify"
	MsgNotifyQuotaLowEmail             = "notify.quota_low_email"
)

const (
	MsgChannelNotifyDisabledSubject = "channel.notify_disabled_subject"
	MsgChannelNotifyDisabledContent = "channel.notify_disabled_content"
	MsgChannelNotifyEnabledSubject  = "channel.notify_enabled_subject"
	MsgChannelNotifyEnabledContent  = "channel.notify_enabled_content"
	MsgChannelTestCompletedSubject  = "channel.test_completed_subject"
	MsgChannelTestCompletedContent  = "channel.test_completed_content"
)

const (
	MsgRateLimitReached                        = "rate_limit.reached"
	MsgRateLimitTotalReached                   = "rate_limit.total_reached"
	MsgDistributorNoAvailableChannelTaskPlugin = "distributor.no_available_channel_task_plugin"
	MsgDistributorInvalidParseModel            = "distributor.invalid_request_parse_model"
	MsgQuotaUserInsufficient                   = "quota.user_insufficient"
	MsgQuotaPreConsumeInsufficient             = "quota.pre_consume_insufficient"
	MsgQuotaSubscriptionInsufficient           = "quota.subscription_insufficient"
	MsgRelayTaskChannelDisabled                = "relay.task_channel_disabled"
	MsgRelayGroupSaturated                     = "relay.group_saturated"
	MsgRelayGroupUpstreamSaturated             = "relay.group_upstream_saturated"
	MsgUserDefaultTokenName                    = "user.default_token_name"
	MsgEmailBindingSubject                     = "email.binding.subject"
	MsgNotificationEmailSubject                = "email.notification.subject"
	MsgNotificationEmailIntro                  = "email.notification.intro"
	MsgEmailBindingNewIntro                    = "email.binding.new_intro"
	MsgEmailBindingOldIntro                    = "email.binding.old_intro"
	MsgEmailBindingCode                        = "email.binding.code"
	MsgEmailBindingNewValidity                 = "email.binding.new_validity"
	MsgEmailBindingOldValidity                 = "email.binding.old_validity"
	MsgEmailSecurityNoticeSubject              = "email.security_notice.subject"
	MsgEmailSecurityNoticeChanged              = "email.security_notice.changed"
	MsgEmailSecurityNoticeAdvice               = "email.security_notice.advice"
	MsgSecurityEventPasswordUpdated            = "email.security_event.password_updated"
	MsgSecurityEventEmailChangeRequested       = "email.security_event.email_change_requested"
	MsgSecurityEventEmailChanged               = "email.security_event.email_changed"
	MsgSecurityEventEmailConfirmed             = "email.security_event.email_confirmed"
	MsgSecurityEventLoginLinked                = "email.security_event.login_linked"
	MsgSecurityEventLoginUnlinked              = "email.security_event.login_unlinked"
	MsgSecurityEventWeChatLinked               = "email.security_event.wechat_linked"
	MsgChannelResponseTimeExceeded             = "channel.response_time_exceeded"
)
