/*
 * SystemSetting — token-system rewrite.
 * Composes auth sub-components from auth/*.jsx.
 */
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
  toBoolean,
} from '../../helpers';
import { useTranslation } from 'react-i18next';
import { ServerCard, SSRFCard } from './auth/ServerAndSSRF';
import LoginRegisterCard from './auth/LoginRegister';
import { PasskeyCard, EmailWhitelistCard, SMTPCard, TurnstileCard } from './auth/PasskeyAndMisc';
import { GitHubOAuthCard, DiscordOAuthCard, LinuxDOOAuthCard, TelegramCard } from './auth/OAuthProviders';

const SystemSetting = () => {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    PasswordLoginEnabled: '',
    PasswordRegisterEnabled: '',
    EmailVerificationEnabled: '',
    GitHubOAuthEnabled: '',
    GitHubClientId: '',
    GitHubClientSecret: '',
    'discord.enabled': '',
    'discord.client_id': '',
    'discord.client_secret': '',
    Notice: '',
    SMTPServer: '',
    SMTPPort: '',
    SMTPAccount: '',
    SMTPFrom: '',
    SMTPToken: '',
    Footer: '',
    TurnstileCheckEnabled: '',
    TurnstileSiteKey: '',
    TurnstileSecretKey: '',
    RegisterEnabled: '',
    'passkey.enabled': '',
    'passkey.rp_display_name': '',
    'passkey.rp_id': '',
    'passkey.origins': [],
    'passkey.allow_insecure_origin': '',
    'passkey.user_verification': 'preferred',
    'passkey.attachment_preference': '',
    EmailDomainRestrictionEnabled: '',
    EmailAliasRestrictionEnabled: '',
    SMTPSSLEnabled: '',
    SMTPForceAuthLogin: '',
    EmailDomainWhitelist: [],
    TelegramOAuthEnabled: '',
    TelegramBotToken: '',
    TelegramBotName: '',
    LinuxDOOAuthEnabled: '',
    LinuxDOClientId: '',
    LinuxDOClientSecret: '',
    LinuxDOMinimumTrustLevel: '',
    ServerAddress: '',
    'fetch_setting.enable_ssrf_protection': true,
    'fetch_setting.allow_private_ip': '',
    'fetch_setting.domain_filter_mode': false,
    'fetch_setting.ip_filter_mode': false,
    'fetch_setting.domain_list': [],
    'fetch_setting.ip_list': [],
    'fetch_setting.allowed_ports': [],
    'fetch_setting.apply_ip_filter_for_domain': true,
  });

  const [originInputs, setOriginInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [emailDomainWhitelist, setEmailDomainWhitelist] = useState([]);
  const [emailToAdd, setEmailToAdd] = useState('');
  const [domainFilterMode, setDomainFilterMode] = useState(true);
  const [ipFilterMode, setIpFilterMode] = useState(true);
  const [domainList, setDomainList] = useState([]);
  const [ipList, setIpList] = useState([]);
  const [allowedPorts, setAllowedPorts] = useState([]);

  const booleanKeys = [
    'PasswordLoginEnabled', 'PasswordRegisterEnabled', 'EmailVerificationEnabled',
    'GitHubOAuthEnabled', 'TelegramOAuthEnabled',
    'RegisterEnabled', 'TurnstileCheckEnabled', 'EmailDomainRestrictionEnabled',
    'EmailAliasRestrictionEnabled', 'SMTPSSLEnabled', 'SMTPForceAuthLogin',
    'LinuxDOOAuthEnabled', 'discord.enabled',
    'passkey.enabled', 'passkey.allow_insecure_origin',
    'fetch_setting.enable_ssrf_protection', 'fetch_setting.allow_private_ip',
    'fetch_setting.domain_filter_mode', 'fetch_setting.ip_filter_mode',
    'fetch_setting.apply_ip_filter_for_domain',
  ];

  const getOptions = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/option/');
      const { success, message, data } = res.data;
      if (success) {
        const newInputs = {};
        data.forEach((item) => {
          let v = item.value;
          if (item.key === 'EmailDomainWhitelist') {
            setEmailDomainWhitelist(v ? v.split(',') : []);
          } else if (item.key === 'fetch_setting.domain_list') {
            try { setDomainList(v ? JSON.parse(v) : []); } catch { setDomainList([]); }
          } else if (item.key === 'fetch_setting.ip_list') {
            try { setIpList(v ? JSON.parse(v) : []); } catch { setIpList([]); }
          } else if (item.key === 'fetch_setting.allowed_ports') {
            try { setAllowedPorts(v ? JSON.parse(v) : []); } catch { setAllowedPorts(['80', '443', '8080', '8443']); }
          } else if (booleanKeys.includes(item.key)) {
            v = toBoolean(v);
          } else if (item.key === 'passkey.origins') {
            v = v || '';
          } else if (item.key === 'passkey.user_verification') {
            v = v || 'preferred';
          } else if (item.key === 'passkey.rp_display_name' || item.key === 'passkey.rp_id' || item.key === 'passkey.attachment_preference') {
            v = v || '';
          }
          newInputs[item.key] = v;
        });
        setInputs(newInputs);
        setOriginInputs(newInputs);
        if (typeof newInputs['fetch_setting.domain_filter_mode'] !== 'undefined') setDomainFilterMode(!!newInputs['fetch_setting.domain_filter_mode']);
        if (typeof newInputs['fetch_setting.ip_filter_mode'] !== 'undefined') setIpFilterMode(!!newInputs['fetch_setting.ip_filter_mode']);
        setIsLoaded(true);
      } else {
        showError(message);
      }
    } catch (e) {
      showError(t('获取设置失败'));
    }
    setLoading(false);
  };

  useEffect(() => { getOptions(); }, []);

  const updateOptions = async (options) => {
    setLoading(true);
    try {
      const checkboxOptions = options.filter((opt) => opt.key.toLowerCase().endsWith('enabled'));
      const otherOptions = options.filter((opt) => !opt.key.toLowerCase().endsWith('enabled'));
      for (const opt of checkboxOptions) {
        const res = await API.put('/api/option/', { key: opt.key, value: opt.value.toString() });
        if (!res.data.success) { showError(res.data.message); return; }
      }
      if (otherOptions.length > 0) {
        const results = await Promise.all(otherOptions.map((opt) =>
          API.put('/api/option/', { key: opt.key, value: typeof opt.value === 'boolean' ? opt.value.toString() : opt.value })
        ));
        results.forEach((res) => { if (!res.data.success) showError(res.data.message); });
      }
      showSuccess(t('更新成功'));
      const newInputs = { ...inputs };
      options.forEach((opt) => { newInputs[opt.key] = opt.value; });
      setInputs(newInputs);
    } catch { showError(t('更新失败')); }
    setLoading(false);
  };

  const submitServerAddress = async () => {
    await updateOptions([{ key: 'ServerAddress', value: removeTrailingSlash(inputs.ServerAddress) }]);
  };

  const submitSMTP = async () => {
    const opts = [];
    if (originInputs.SMTPServer !== inputs.SMTPServer) opts.push({ key: 'SMTPServer', value: inputs.SMTPServer });
    if (originInputs.SMTPAccount !== inputs.SMTPAccount) opts.push({ key: 'SMTPAccount', value: inputs.SMTPAccount });
    if (originInputs.SMTPFrom !== inputs.SMTPFrom) opts.push({ key: 'SMTPFrom', value: inputs.SMTPFrom });
    if (originInputs.SMTPPort !== inputs.SMTPPort && inputs.SMTPPort !== '') opts.push({ key: 'SMTPPort', value: inputs.SMTPPort });
    if (originInputs.SMTPToken !== inputs.SMTPToken && inputs.SMTPToken !== '') opts.push({ key: 'SMTPToken', value: inputs.SMTPToken });
    if (opts.length > 0) await updateOptions(opts);
  };

  const submitSSRF = async () => {
    const opts = [
      { key: 'fetch_setting.domain_filter_mode', value: domainFilterMode },
      { key: 'fetch_setting.ip_filter_mode', value: ipFilterMode },
    ];
    if (Array.isArray(domainList)) opts.push({ key: 'fetch_setting.domain_list', value: JSON.stringify(domainList) });
    if (Array.isArray(ipList)) opts.push({ key: 'fetch_setting.ip_list', value: JSON.stringify(ipList) });
    if (Array.isArray(allowedPorts)) opts.push({ key: 'fetch_setting.allowed_ports', value: JSON.stringify(allowedPorts) });
    if (opts.length > 0) await updateOptions(opts);
  };

  const submitGitHubOAuth = async () => {
    const opts = [];
    if (originInputs.GitHubClientId !== inputs.GitHubClientId) opts.push({ key: 'GitHubClientId', value: inputs.GitHubClientId });
    if (originInputs.GitHubClientSecret !== inputs.GitHubClientSecret && inputs.GitHubClientSecret !== '') opts.push({ key: 'GitHubClientSecret', value: inputs.GitHubClientSecret });
    if (opts.length > 0) await updateOptions(opts);
  };

  const submitDiscordOAuth = async () => {
    const opts = [];
    if (originInputs['discord.client_id'] !== inputs['discord.client_id']) opts.push({ key: 'discord.client_id', value: inputs['discord.client_id'] });
    if (originInputs['discord.client_secret'] !== inputs['discord.client_secret'] && inputs['discord.client_secret'] !== '') opts.push({ key: 'discord.client_secret', value: inputs['discord.client_secret'] });
    if (opts.length > 0) await updateOptions(opts);
  };

  const submitTelegramSettings = async () => {
    await updateOptions([
      { key: 'TelegramBotToken', value: inputs.TelegramBotToken },
      { key: 'TelegramBotName', value: inputs.TelegramBotName },
    ]);
  };

  const submitTurnstile = async () => {
    const opts = [];
    if (originInputs.TurnstileSiteKey !== inputs.TurnstileSiteKey) opts.push({ key: 'TurnstileSiteKey', value: inputs.TurnstileSiteKey });
    if (originInputs.TurnstileSecretKey !== inputs.TurnstileSecretKey && inputs.TurnstileSecretKey !== '') opts.push({ key: 'TurnstileSecretKey', value: inputs.TurnstileSecretKey });
    if (opts.length > 0) await updateOptions(opts);
  };

  const submitLinuxDOOAuth = async () => {
    const opts = [];
    if (originInputs.LinuxDOClientId !== inputs.LinuxDOClientId) opts.push({ key: 'LinuxDOClientId', value: inputs.LinuxDOClientId });
    if (originInputs.LinuxDOClientSecret !== inputs.LinuxDOClientSecret && inputs.LinuxDOClientSecret !== '') opts.push({ key: 'LinuxDOClientSecret', value: inputs.LinuxDOClientSecret });
    if (originInputs.LinuxDOMinimumTrustLevel !== inputs.LinuxDOMinimumTrustLevel) opts.push({ key: 'LinuxDOMinimumTrustLevel', value: inputs.LinuxDOMinimumTrustLevel });
    if (opts.length > 0) await updateOptions(opts);
  };

  const submitPasskeySettings = async () => {
    await updateOptions([
      { key: 'passkey.rp_display_name', value: inputs['passkey.rp_display_name'] || '' },
      { key: 'passkey.rp_id', value: inputs['passkey.rp_id'] || '' },
      { key: 'passkey.user_verification', value: inputs['passkey.user_verification'] || 'preferred' },
      { key: 'passkey.attachment_preference', value: inputs['passkey.attachment_preference'] || '' },
      { key: 'passkey.origins', value: inputs['passkey.origins'] || '' },
    ]);
  };

  if (!isLoaded) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 size={24} className='animate-spin text-ui-text-3' />
      </div>
    );
  }

  const sectionGap = <div className='border-t border-ui-divider' />;

  return (
    <div className='space-y-6'>
      <ServerCard inputs={inputs} setInputs={setInputs} submitServerAddress={submitServerAddress} t={t} />
      {sectionGap}
      <SSRFCard
        inputs={inputs} setInputs={setInputs}
        domainFilterMode={domainFilterMode} setDomainFilterMode={setDomainFilterMode}
        ipFilterMode={ipFilterMode} setIpFilterMode={setIpFilterMode}
        domainList={domainList} setDomainList={setDomainList}
        ipList={ipList} setIpList={setIpList}
        allowedPorts={allowedPorts} setAllowedPorts={setAllowedPorts}
        handleCheckboxChange={(key, e) => updateOptions([{ key, value: e.target.checked }])}
        submitSSRF={submitSSRF} t={t}
      />
      {sectionGap}
      <LoginRegisterCard inputs={inputs} updateOptions={updateOptions} t={t} />
      {sectionGap}
      <PasskeyCard inputs={inputs} setInputs={setInputs} submitPasskeySettings={submitPasskeySettings} t={t} />
      {sectionGap}
      <EmailWhitelistCard
        inputs={inputs} updateOptions={updateOptions}
        emailDomainWhitelist={emailDomainWhitelist} setEmailDomainWhitelist={setEmailDomainWhitelist}
        emailToAdd={emailToAdd} setEmailToAdd={setEmailToAdd} t={t}
      />
      {sectionGap}
      <SMTPCard inputs={inputs} setInputs={setInputs} submitSMTP={submitSMTP} t={t} />
      {sectionGap}
      <GitHubOAuthCard inputs={inputs} setInputs={setInputs} submitGitHubOAuth={submitGitHubOAuth} t={t} />
      {sectionGap}
      <DiscordOAuthCard inputs={inputs} setInputs={setInputs} submitDiscordOAuth={submitDiscordOAuth} t={t} />
      {sectionGap}
      <LinuxDOOAuthCard inputs={inputs} setInputs={setInputs} submitLinuxDOOAuth={submitLinuxDOOAuth} t={t} />
      {sectionGap}
      <TelegramCard inputs={inputs} setInputs={setInputs} submitTelegramSettings={submitTelegramSettings} t={t} />
      {sectionGap}
      <TurnstileCard inputs={inputs} setInputs={setInputs} submitTurnstile={submitTurnstile} t={t} />
    </div>
  );
};

export default SystemSetting;
