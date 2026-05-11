/*
 * 服务器地址 + SSRF 防护 — token-system rewrite.
 * Props: inputs, setInputs, domainFilterMode, setDomainFilterMode,
 *        ipFilterMode, setIpFilterMode, domainList, setDomainList,
 *        ipList, setIpList, allowedPorts, setAllowedPorts,
 *        submitServerAddress, submitSSRF, t
 */
import React from 'react';
import {
  FieldRow,
  TextField,
  ToggleField,
  Notice,
  TagInput,
  RadioChipGroup,
} from '../../common/form/Primitives';
import { Button } from '../../ui';

export function ServerCard({ inputs, setInputs, submitServerAddress, t }) {
  return (
    <div className='space-y-3'>
      <span className='text-sm font-semibold text-ui-text'>{t('通用设置')}</span>
      <FieldRow label={t('服务器地址')} hint={t('该服务器地址将影响支付回调地址以及默认首页展示的地址，请确保正确配置')}>
        <div className='flex gap-2'>
          <input
            type='url'
            value={inputs.ServerAddress || ''}
            onChange={(e) => setInputs((prev) => ({ ...prev, ServerAddress: e.target.value }))}
            placeholder='https://yourdomain.com'
            className='flex-1 rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'
          />
          <Button variant='primary' size='sm' onClick={submitServerAddress}>
            {t('更新')}
          </Button>
        </div>
      </FieldRow>
    </div>
  );
}

export function SSRFCard({
  inputs, setInputs, domainFilterMode, setDomainFilterMode,
  ipFilterMode, setIpFilterMode, domainList, setDomainList,
  ipList, setIpList, allowedPorts, setAllowedPorts,
  handleCheckboxChange, submitSSRF, t,
}) {
  return (
    <div className='space-y-3'>
      <span className='text-sm font-semibold text-ui-text'>{t('SSRF 防护设置')}</span>
      <Notice kind='info'>{t('配置服务器端请求伪造 (SSRF) 防护，用于保护内网资源安全')}</Notice>
      <ToggleField
        label={t('启用 SSRF 防护（推荐开启）')}
        checked={!!inputs['fetch_setting.enable_ssrf_protection']}
        onChange={(v) => handleCheckboxChange('fetch_setting.enable_ssrf_protection', { target: { checked: v } })}
      />
      <ToggleField
        label={t('允许访问私有 IP 地址')}
        hint={t('127.0.0.1、192.168.x.x 等内网地址')}
        checked={!!inputs['fetch_setting.allow_private_ip']}
        onChange={(v) => handleCheckboxChange('fetch_setting.allow_private_ip', { target: { checked: v } })}
      />
      <ToggleField
        label={t('对域名启用 IP 过滤（推荐开启）')}
        checked={!!inputs['fetch_setting.apply_ip_filter_for_domain']}
        onChange={(v) => handleCheckboxChange('fetch_setting.apply_ip_filter_for_domain', { target: { checked: v } })}
      />

      {/* Domain filter */}
      <div className='space-y-2'>
        <div className='text-xs font-medium text-ui-text-2'>
          {domainFilterMode ? t('域名白名单') : t('域名黑名单')}
          <span className='text-ui-text-3 ml-1'>({t('支持通配符格式，如 example.com, *.api.example.com')})</span>
        </div>
        <RadioChipGroup
          value={domainFilterMode ? 'whitelist' : 'blacklist'}
          onChange={(v) => {
            const isWhitelist = v === 'whitelist';
            setDomainFilterMode(isWhitelist);
            setInputs((prev) => ({ ...prev, 'fetch_setting.domain_filter_mode': isWhitelist }));
          }}
          options={[{ value: 'whitelist', label: t('白名单') }, { value: 'blacklist', label: t('黑名单') }]}
        />
        <TagInput value={domainList} onChange={(value) => { setDomainList(value); setInputs((prev) => ({ ...prev, 'fetch_setting.domain_list': value })); }} placeholder={t('输入域名后回车，如 example.com')} />
      </div>

      {/* IP filter */}
      <div className='space-y-2'>
        <div className='text-xs font-medium text-ui-text-2'>
          {ipFilterMode ? t('IP 白名单') : t('IP 黑名单')}
          <span className='text-ui-text-3 ml-1'>({t('支持 CIDR 格式，如 8.8.8.8, 192.168.1.0/24')})</span>
        </div>
        <RadioChipGroup
          value={ipFilterMode ? 'whitelist' : 'blacklist'}
          onChange={(v) => {
            const isWhitelist = v === 'whitelist';
            setIpFilterMode(isWhitelist);
            setInputs((prev) => ({ ...prev, 'fetch_setting.ip_filter_mode': isWhitelist }));
          }}
          options={[{ value: 'whitelist', label: t('白名单') }, { value: 'blacklist', label: t('黑名单') }]}
        />
        <TagInput value={ipList} onChange={(value) => { setIpList(value); setInputs((prev) => ({ ...prev, 'fetch_setting.ip_list': value })); }} placeholder={t('输入 IP 地址后回车，如 8.8.8.8')} />
      </div>

      {/* Ports */}
      <div className='space-y-2'>
        <div className='text-xs font-medium text-ui-text-2'>
          {t('允许的端口')}
          <span className='text-ui-text-3 ml-1'>({t('支持单个端口和端口范围，如 80, 443, 8000-8999')})</span>
        </div>
        <TagInput value={allowedPorts} onChange={(value) => { setAllowedPorts(value); setInputs((prev) => ({ ...prev, 'fetch_setting.allowed_ports': value })); }} placeholder={t('输入端口后回车，如 80 或 8000-8999')} />
      </div>

      <Button variant='primary' size='sm' onClick={submitSSRF}>
        {t('更新 SSRF 防护设置')}
      </Button>
    </div>
  );
}
