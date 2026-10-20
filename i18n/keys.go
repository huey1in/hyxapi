package i18n

const MsgTokenStatusUnavailable = "token.status_unavailable"
const MsgAuthClientIPUnresolved = "auth.client_ip_unresolved"
const MsgAuthTokenIPNotAllowed = "auth.token_ip_not_allowed"

// Message keys for i18n translations
// Use these constants instead of hardcoded strings

// Common error messages
const (
	MsgInvalidParams  = "common.invalid_params"
	MsgDatabaseError  = "common.database_error"
	MsgGenerateFailed = "common.generate_failed"
	MsgUpdateSuccess  = "common.update_success"
	MsgUpdateFailed   = "common.update_failed"
	MsgBatchTooMany   = "common.batch_too_many"
)

// Auth middleware messages
const (
	MsgAuthNotLoggedIn           = "auth.not_logged_in"
	MsgAuthAccessTokenInvalid    = "auth.access_token_invalid"
	MsgAuthUserInfoInvalid       = "auth.user_info_invalid"
	MsgAuthUserIdNotProvided     = "auth.user_id_not_provided"
	MsgAuthUserIdFormatError     = "auth.user_id_format_error"
	MsgAuthUserIdMismatch        = "auth.user_id_mismatch"
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

// User related messages
const (
	MsgUserPasswordLoginDisabled     = "user.password_login_disabled"
	MsgUserRegisterDisabled          = "user.register_disabled"
	MsgUserPasswordRegisterDisabled  = "user.password_register_disabled"
	MsgUserUsernameOrPasswordError   = "user.username_or_password_error"
	MsgUserExists                    = "user.exists"
	MsgUserNotExists                 = "user.not_exists"
	MsgUserSessionSaveFailed         = "user.session_save_failed"
	MsgUserRequire2FA                = "user.require_2fa"
	MsgUserEmailVerificationRequired = "user.email_verification_required"
	MsgUserVerificationCodeError     = "user.verification_code_error"
	MsgUserInputInvalid              = "user.input_invalid"
	MsgUserNoPermissionSameLevel     = "user.no_permission_same_level"
	MsgUserNoPermissionHigherLevel   = "user.no_permission_higher_level"
	MsgUserCannotCreateHigherLevel   = "user.cannot_create_higher_level"
	MsgUserCannotDeleteRootUser      = "user.cannot_delete_root_user"
	MsgUserCannotDisableRootUser     = "user.cannot_disable_root_user"
	MsgUserCannotDemoteRootUser      = "user.cannot_demote_root_user"
	MsgUserAlreadyAdmin              = "user.already_admin"
	MsgUserAlreadyCommon             = "user.already_common"
	MsgUserAdminCannotPromote        = "user.admin_cannot_promote"
	MsgUserTopUpProcessing           = "user.topup_processing"
	MsgUserRegisterFailed            = "user.register_failed"
	MsgUserDefaultTokenFailed        = "user.default_token_failed"
	MsgUserQuotaChangeZero           = "user.quota_change_zero"
)

// OAuth related messages
const (
	MsgOAuthInvalidCode     = "oauth.invalid_code"
	MsgOAuthGetUserErr      = "oauth.get_user_error"
	MsgOAuthUnknownProvider = "oauth.unknown_provider"
	MsgOAuthStateInvalid    = "oauth.state_invalid"
	MsgOAuthNotEnabled      = "oauth.not_enabled"
	MsgOAuthUserDeleted     = "oauth.user_deleted"
	MsgOAuthUserBanned      = "oauth.user_banned"
	MsgOAuthBindSuccess     = "oauth.bind_success"
	MsgOAuthAlreadyBound    = "oauth.already_bound"
	MsgOAuthConnectFailed   = "oauth.connect_failed"
	MsgOAuthTokenFailed     = "oauth.token_failed"
	MsgOAuthUserInfoEmpty   = "oauth.user_info_empty"
	MsgOAuthTrustLevelLow   = "oauth.trust_level_low"
)

// Model layer error messages (for translation in controller)
const (
	MsgRedeemFailed          = "redeem.failed"
	MsgCreateDefaultTokenErr = "user.create_default_token_error"
	MsgUuidDuplicate         = "common.uuid_duplicate"
	MsgInvalidInput          = "common.invalid_input"
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
	MsgAuthTokenGroupForbidden                 = "auth.token_group_forbidden"
	MsgAuthTokenGroupDeprecated                = "auth.token_group_deprecated"
	MsgAuthChannelSelectForbidden              = "auth.channel_select_forbidden"
	MsgRateLimitReached                        = "rate_limit.reached"
	MsgRateLimitTotalReached                   = "rate_limit.total_reached"
	MsgDistributorNoAvailableChannelTaskPlugin = "distributor.no_available_channel_task_plugin"
	MsgDistributorInvalidParseModel            = "distributor.invalid_request_parse_model"
	MsgQuotaUserInsufficient                   = "quota.user_insufficient"
	MsgQuotaPreConsumeInsufficient             = "quota.pre_consume_insufficient"
	MsgQuotaSubscriptionInsufficient           = "quota.subscription_insufficient"
	MsgRelayModelPriceNotConfigured            = "relay.model_price_not_configured"
	MsgRelayModelPriceNotConfiguredAdmin       = "relay.model_price_not_configured_admin"
	MsgRelayTaskChannelDisabled                = "relay.task_channel_disabled"
	MsgRelayGroupSaturated                     = "relay.group_saturated"
	MsgRelayGroupUpstreamSaturated             = "relay.group_upstream_saturated"
	MsgRelayRetryGetChannelFailed              = "relay.retry_get_channel_failed"
	MsgRelayRetryNoAvailableChannel            = "relay.retry_no_available_channel"
	MsgRelayAccessTokenUnsupported             = "relay.access_token_unsupported"
	MsgUserDefaultTokenName                    = "user.default_token_name"
	MsgEmailVerificationSubject                = "email.verification.subject"
	MsgEmailVerificationGreeting               = "email.verification.greeting"
	MsgEmailVerificationCode                   = "email.verification.code"
	MsgEmailVerificationValidity               = "email.verification.validity"
	MsgEmailPasswordResetSubject               = "email.password_reset.subject"
	MsgEmailPasswordResetGreeting              = "email.password_reset.greeting"
	MsgEmailPasswordResetLink                  = "email.password_reset.link"
	MsgEmailPasswordResetLinkFallback          = "email.password_reset.link_fallback"
	MsgEmailPasswordResetValidity              = "email.password_reset.validity"
	MsgEmailBindingSubject                     = "email.binding.subject"
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
	MsgChannelUpstreamUpdateNotifySubject      = "channel.upstream_update_notify_subject"
	MsgChannelUpstreamUpdateSummary            = "channel.upstream_update_summary"
	MsgChannelUpstreamUpdateChangedChannels    = "channel.upstream_update_changed_channels"
	MsgChannelUpstreamUpdateMoreChannels       = "channel.upstream_update_more_channels"
	MsgChannelUpstreamUpdateAddedModels        = "channel.upstream_update_added_models"
	MsgChannelUpstreamUpdateRemovedModels      = "channel.upstream_update_removed_models"
	MsgChannelUpstreamUpdateFailedChannels     = "channel.upstream_update_failed_channels"
	MsgChannelUpstreamUpdateMoreOmitted        = "channel.upstream_update_more_omitted"
)
