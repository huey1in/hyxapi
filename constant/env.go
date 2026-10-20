package constant

var StreamingTimeout int
var DifyDebug bool
var MaxFileDownloadMB int
var StreamScannerMaxBufferMB int
var ForceStreamOption bool
var CountToken bool
var GetMediaToken bool
var GetMediaTokenNotStream bool
var MaxRequestBodyMB int
var AzureDefaultAPIVersion string
var NotifyLimitCount int
var NotificationLimitDurationMinute int
var GenerateDefaultToken bool
var ErrorLogEnabled bool
var TaskPricePatches []string
var TaskTimeoutMinutes int
var TaskQueryLimit = 1000
var TaskPollMaxFailures = 20

// AnonymousRequestBodyLimitKB 匿名接口请求体上限（KB），0/负数回退默认 512KB。
var AnonymousRequestBodyLimitKB int

var TaskPluginProtocolTimeoutSeconds = 300
var TaskPluginProtocolTickMilliseconds = 1000
var TaskPluginProtocolTickJitterMilliseconds = 250
var TaskPluginProtocolHeartbeatSeconds = 15

var UpdateTask = true

// TrustedRedirectDomains configures allowed custom checkout return hosts.
var TrustedRedirectDomains []string
