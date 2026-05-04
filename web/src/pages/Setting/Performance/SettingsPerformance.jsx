/*
 * 性能设置 — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import {
  SectionWithSave,
  FieldRow,
  TextField,
  ToggleField,
  NumberField,
  Notice,
  RadioChipGroup,
} from '../../../components/common/form/Primitives';
import { showConfirm } from '../../../components/common/ConfirmDialog';

function formatBytes(bytes, decimals = 2) {
  if (bytes == null || isNaN(bytes)) return '0 Bytes';
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return '-' + formatBytes(-bytes, decimals);
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0 || i >= sizes.length) return bytes + ' Bytes';
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function ProgressBar({ percent, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <div className='w-full h-2 rounded-full bg-ui-bg-subtle overflow-hidden'>
      <div
        className={`h-full rounded-full transition-all duration-300 ${colorClasses[color] || colorClasses.blue}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <div className='rounded-md border border-ui-border bg-ui-bg-subtle px-3 py-2'>
      <div className='text-[11px] text-ui-text-3 mb-0.5'>{label}</div>
      <div className='text-sm font-semibold text-ui-text tabular-nums'>
        {value}
        {unit && <span className='text-ui-text-3 text-xs font-normal ml-1'>{unit}</span>}
      </div>
    </div>
  );
}

const DEFAULTS = {
  'performance_setting.disk_cache_enabled': false,
  'performance_setting.disk_cache_threshold_mb': 10,
  'performance_setting.disk_cache_max_size_mb': 1024,
  'performance_setting.disk_cache_path': '',
  'performance_setting.monitor_enabled': false,
  'performance_setting.monitor_cpu_threshold': 90,
  'performance_setting.monitor_memory_threshold': 90,
  'performance_setting.monitor_disk_threshold': 95,
};

export default function SettingsPerformance(props) {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState(DEFAULTS);
  const [original, setOriginal] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [logInfo, setLogInfo] = useState(null);
  const [logCleanupMode, setLogCleanupMode] = useState('by_count');
  const [logCleanupValue, setLogCleanupValue] = useState(10);
  const [logCleanupLoading, setLogCleanupLoading] = useState(false);

  useEffect(() => {
    const next = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (k in (props.options || {})) {
        const v = props.options[k];
        if (typeof DEFAULTS[k] === 'boolean') next[k] = v === 'true' || v === true;
        else if (typeof DEFAULTS[k] === 'number') next[k] = parseInt(v) || DEFAULTS[k];
        else next[k] = v;
      }
    }
    setInputs(next);
    setOriginal(structuredClone(next));
    fetchStats();
    fetchLogInfo();
  }, [props.options]);

  const set = (k) => (v) => setInputs((p) => ({ ...p, [k]: v }));

  const diskEnabled = inputs['performance_setting.disk_cache_enabled'];
  const monitorEnabled = inputs['performance_setting.monitor_enabled'];

  const submit = () => {
    const diff = compareObjects(inputs, original);
    if (!diff.length) return showWarning(t('你似乎并没有修改什么'));
    setLoading(true);
    Promise.all(
      diff.map((item) =>
        API.put('/api/option/', {
          key: item.key,
          value: String(inputs[item.key]),
        }),
      ),
    )
      .then((res) => {
        if (res.includes(undefined) && diff.length > 1)
          return showError(t('部分保存失败，请重试'));
        showSuccess(t('保存成功'));
        props.refresh();
        fetchStats();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  async function fetchStats() {
    setStatsLoading(true);
    try {
      const res = await API.get('/api/performance/stats');
      if (res.data.success) setStats(res.data.data);
    } catch {} finally { setStatsLoading(false); }
  }

  async function fetchLogInfo() {
    try {
      const res = await API.get('/api/performance/logs');
      if (res.data.success) setLogInfo(res.data.data);
    } catch {}
  }

  async function clearDiskCache() {
    try {
      const res = await API.delete('/api/performance/disk_cache');
      if (res.data.success) { showSuccess(t('磁盘缓存已清理')); fetchStats(); }
      else showError(res.data.message || t('清理失败'));
    } catch { showError(t('清理失败')); }
  }

  async function resetStats() {
    try {
      const res = await API.post('/api/performance/reset_stats');
      if (res.data.success) { showSuccess(t('统计已重置')); fetchStats(); }
    } catch { showError(t('重置失败')); }
  }

  async function forceGC() {
    try {
      const res = await API.post('/api/performance/gc');
      if (res.data.success) { showSuccess(t('GC 已执行')); fetchStats(); }
    } catch { showError(t('GC 执行失败')); }
  }

  async function cleanupLogFiles() {
    if (logCleanupValue == null || isNaN(logCleanupValue) || logCleanupValue < 1) {
      return showError(t('请输入有效的数值'));
    }
    showConfirm({
      title: t('确认清理日志文件？'),
      content:
        logCleanupMode === 'by_count'
          ? t('将只保留最近 {{value}} 个日志文件，其余将被删除。', { value: logCleanupValue })
          : t('将删除 {{value}} 天前的日志文件。', { value: logCleanupValue }),
      danger: true,
      okText: t('确认清理'),
      onOk: async () => {
        setLogCleanupLoading(true);
        try {
          const res = await API.delete(
            `/api/performance/logs?mode=${logCleanupMode}&value=${logCleanupValue}`,
          );
          if (res.data.success) {
            const { deleted_count, freed_bytes } = res.data.data;
            showSuccess(
              t('已清理 {{count}} 个日志文件，释放 {{size}}', {
                count: deleted_count,
                size: formatBytes(freed_bytes),
              }),
            );
          } else showError(res.data.message || t('清理失败'));
          fetchLogInfo();
        } catch { showError(t('清理失败')); }
        finally { setLogCleanupLoading(false); }
      },
    });
  }

  const diskCacheUsagePercent =
    stats?.cache_stats?.disk_cache_max_bytes > 0
      ? ((stats.cache_stats.current_disk_usage_bytes / stats.cache_stats.disk_cache_max_bytes) * 100).toFixed(1)
      : 0;

  return (
    <div className='space-y-6'>
      <SectionWithSave
        title={t('磁盘缓存设置')}
        hint={t('磁盘换内存：大请求体临时存储到磁盘而非内存，降低内存占用；建议在 SSD 环境下使用')}loading={loading}
        onSave={submit}
        onSaveLabel={t('保存性能设置')}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
          <ToggleField
            label={t('启用磁盘缓存')}
            hint={t('将大请求体临时存储到磁盘')}
            checked={diskEnabled}
            onChange={set('performance_setting.disk_cache_enabled')}
          />
          <FieldRow label={t('磁盘缓存阈值 (MB)')} hint={t('请求体超过此大小时使用磁盘缓存')}>
            <NumberField
              value={Number(inputs['performance_setting.disk_cache_threshold_mb']) || 10}
              onChange={(v) => set('performance_setting.disk_cache_threshold_mb')(parseInt(v) || 10)}
              min={1} max={1024} step={1} disabled={!diskEnabled}
            />
          </FieldRow>
          <FieldRow
            label={t('磁盘缓存最大总量 (MB)')}
            hint={
              stats?.disk_space_info?.total > 0
                ? `${t('可用空间')}: ${formatBytes(stats.disk_space_info.free)} / ${t('总空间')}: ${formatBytes(stats.disk_space_info.total)}`
                : t('磁盘缓存占用的最大空间')
            }
          >
            <NumberField
              value={Number(inputs['performance_setting.disk_cache_max_size_mb']) || 1024}
              onChange={(v) => set('performance_setting.disk_cache_max_size_mb')(parseInt(v) || 1024)}
              min={100} max={102400} step={1} disabled={!diskEnabled}
            />
          </FieldRow>
          {!stats?.config?.is_running_in_container && (
            <FieldRow label={t('缓存目录')} hint={t('留空使用系统临时目录')}>
              <TextField
                value={inputs['performance_setting.disk_cache_path'] || ''}
                onChange={set('performance_setting.disk_cache_path')}
                placeholder={t('例如 /var/cache/new-api')}
                disabled={!diskEnabled}
              />
            </FieldRow>
          )}
        </div>
      </SectionWithSave>

      <SectionWithSave
        title={t('系统性能监控')}
        hint={t('当系统资源使用率超过阈值时，拒绝新的 Relay 请求 (/v1, /v1beta 等)')}>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
          <ToggleField
            label={t('启用性能监控')}
            hint={t('超过阈值时拒绝新请求')}
            checked={monitorEnabled}
            onChange={set('performance_setting.monitor_enabled')}
          />
          <FieldRow label={t('CPU 阈值 (%)')} hint={t('CPU 使用率超过此值时拒绝请求')}>
            <NumberField
              value={Number(inputs['performance_setting.monitor_cpu_threshold']) || 90}
              onChange={(v) => set('performance_setting.monitor_cpu_threshold')(parseInt(v) || 90)}
              min={0} max={100} step={1} disabled={!monitorEnabled}
            />
          </FieldRow>
          <FieldRow label={t('内存阈值 (%)')} hint={t('内存使用率超过此值时拒绝请求')}>
            <NumberField
              value={Number(inputs['performance_setting.monitor_memory_threshold']) || 90}
              onChange={(v) => set('performance_setting.monitor_memory_threshold')(parseInt(v) || 90)}
              min={0} max={100} step={1} disabled={!monitorEnabled}
            />
          </FieldRow>
          <FieldRow label={t('磁盘阈值 (%)')} hint={t('磁盘使用率超过此值时拒绝请求')}>
            <NumberField
              value={Number(inputs['performance_setting.monitor_disk_threshold']) || 95}
              onChange={(v) => set('performance_setting.monitor_disk_threshold')(parseInt(v) || 95)}
              min={0} max={100} step={1} disabled={!monitorEnabled}
            />
          </FieldRow>
        </div>
      </SectionWithSave>

      {/* 日志管理 */}
      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 rounded-md inline-flex items-center justify-center border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'>
            </div>
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-semibold text-ui-text'>{t('服务器日志管理')}</div>
            <div className='text-[11px] text-ui-text-3 mt-0.5'>
              {t('管理服务器运行日志文件；日志文件会随运行时间累积，建议定期清理')}
            </div>
          </div>
        </div>

        {logInfo === null ? null : logInfo.enabled ? (
          <>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
              <StatCard label={t('日志目录')} value={logInfo.log_dir} />
              <StatCard label={t('日志文件数')} value={logInfo.file_count} />
              <StatCard label={t('日志总大小')} value={formatBytes(logInfo.total_size)} />
              {logInfo.oldest_time && logInfo.newest_time && (
                <StatCard
                  label={t('日志时间范围')}
                  value={`${new Date(logInfo.oldest_time).toLocaleDateString()} ~ ${new Date(logInfo.newest_time).toLocaleDateString()}`}
                />
              )}
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
              <FieldRow label={t('清理方式')}>
                <RadioChipGroup
                  value={logCleanupMode}
                  onChange={setLogCleanupMode}
                  options={[
                    { value: 'by_count', label: t('保留最近 N 个文件') },
                    { value: 'by_days', label: t('保留最近 N 天') },
                  ]}
                />
              </FieldRow>
              <FieldRow label={logCleanupMode === 'by_count' ? t('保留文件数') : t('保留天数')}>
                <NumberField
                  value={logCleanupValue}
                  onChange={setLogCleanupValue}
                  min={1} max={logCleanupMode === 'by_count' ? 1000 : 3650} step={1}
                />
              </FieldRow>
              <FieldRow label=' '>
                <button
                  type='button'
                  onClick={cleanupLogFiles}
                  disabled={logCleanupLoading}
                  className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg disabled:opacity-50'
                >
                  {t('清理日志文件')}
                </button>
              </FieldRow>
            </div>
          </>
        ) : (
          <Notice kind='warning'>
            {t('服务器日志功能未启用（未配置日志目录）')}
          </Notice>
        )}
      </div>

      {/* 性能统计 */}
      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 rounded-md inline-flex items-center justify-center border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'>
            </div>
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-semibold text-ui-text'>{t('性能监控')}</div>
          </div>
          <div className='flex items-center gap-2'>
            <button onClick={fetchStats} className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'>
              {t('刷新')}
            </button>
            <button
              onClick={() =>
                showConfirm({
                  title: t('确认清理不活跃的磁盘缓存？'),
                  content: t('这将删除超过 10 分钟未使用的临时缓存文件'),
                  danger: true,
                  okText: t('确认清理'),
                  onOk: clearDiskCache,
                })
              }
              className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'
            >
              {t('清理缓存')}
            </button>
            <button onClick={resetStats} className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'>
              {t('重置统计')}
            </button>
            <button onClick={forceGC} className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'>
              {t('执行 GC')}
            </button>
          </div>
        </div>

        {statsLoading ? (
          <div className='flex items-center justify-center py-8 text-ui-text-3'>
            {t('加载中...')}
          </div>
        ) : stats ? (
          <>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {/* 磁盘缓存 */}
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 space-y-2'>
                <div className='text-xs font-semibold text-ui-text'>{t('请求体磁盘缓存')}</div>
                <ProgressBar percent={parseFloat(diskCacheUsagePercent)} color={parseFloat(diskCacheUsagePercent) > 80 ? 'red' : 'blue'} />
                <div className='flex justify-between text-[11px] text-ui-text-3'>
                  <span>{formatBytes(stats.cache_stats.current_disk_usage_bytes)} / {formatBytes(stats.cache_stats.disk_cache_max_bytes)}</span>
                  <span>{t('活跃文件')}: {stats.cache_stats.active_disk_files}</span>
                </div>
                <span className='inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'>
                  {t('磁盘命中')}: {stats.cache_stats.disk_cache_hits}
                </span>
              </div>

              {/* 内存缓存 */}
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 space-y-2'>
                <div className='text-xs font-semibold text-ui-text'>{t('请求体内存缓存')}</div>
                <div className='flex justify-between text-[11px] text-ui-text'>
                  <span>{t('当前缓存大小')}: {formatBytes(stats.cache_stats.current_memory_usage_bytes)}</span>
                  <span>{t('活跃缓存数')}: {stats.cache_stats.active_memory_buffers}</span>
                </div>
                <span className='inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'>
                  {t('内存命中')}: {stats.cache_stats.memory_cache_hits}
                </span>
              </div>
            </div>

            {/* 磁盘空间 */}
            {stats.disk_space_info?.total > 0 && (
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 space-y-2'>
                <div className='text-xs font-semibold text-ui-text'>{t('缓存目录磁盘空间')}</div>
                <ProgressBar
                  percent={parseFloat(stats.disk_space_info.used_percent.toFixed(1))}
                  color={
                    stats.disk_space_info.used_percent > 90 ? 'red'
                      : stats.disk_space_info.used_percent > 70 ? 'amber' : 'green'
                  }
                />
                <div className='flex flex-wrap justify-between text-[11px] text-ui-text-3 gap-2'>
                  <span>{t('已用')}: {formatBytes(stats.disk_space_info.used)}</span>
                  <span>{t('可用')}: {formatBytes(stats.disk_space_info.free)}</span>
                  <span>{t('总计')}: {formatBytes(stats.disk_space_info.total)}</span>
                </div>
                {stats.disk_space_info.free < inputs['performance_setting.disk_cache_max_size_mb'] * 1024 * 1024 && (
                  <Notice kind='warning'>
                    {t('磁盘可用空间小于缓存最大总量设置')}
                  </Notice>
                )}
              </div>
            )}

            {/* 系统内存统计 */}
            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3'>
              <StatCard label={t('已分配内存')} value={formatBytes(stats.memory_stats.alloc)} />
              <StatCard label={t('总分配内存')} value={formatBytes(stats.memory_stats.total_alloc)} />
              <StatCard label={t('系统内存')} value={formatBytes(stats.memory_stats.sys)} />
              <StatCard label={t('GC 次数')} value={stats.memory_stats.num_gc} />
              <StatCard label={t('Goroutine 数')} value={stats.memory_stats.num_goroutine} />
              <StatCard label={t('缓存目录')} value={stats.disk_cache_info.path} />
              <StatCard label={t('目录文件数')} value={stats.disk_cache_info.file_count} />
              <StatCard label={t('目录总大小')} value={formatBytes(stats.disk_cache_info.total_size)} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
