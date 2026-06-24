package setting

// 多 Key 合一模式：单个 Key 在时间窗口内失败达到阈值后临时冷却，到期自动恢复。
var MultiKeyCooldownEnabled = false       // 是否启用单 Key 自动冷却
var MultiKeyCooldownThreshold = 3         // 统计窗口内失败次数阈值
var MultiKeyCooldownWindowMinutes = 1     // 失败统计时间窗口（分钟）
var MultiKeyCooldownDurationMinutes = 5   // 触发后冷却时长（分钟）
