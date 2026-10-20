import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { CodeBlock, Select } from '../../components/ui';
import type { ManagedToken } from './token-management';

type Props = { origin: string; rows: ManagedToken[]; keys: Record<string, string> };
const CodeSamples = ({ origin, rows = [], keys = {} }: Props) => {
  const { t } = useTranslation();
  const [tool, setTool] = useState('claude');
  const [shell, setShell] = useState<'cmd' | 'powershell' | 'unix'>('cmd');
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [showKey, setShowKey] = useState(false);
  const tokenOptions = useMemo(() => rows
    .filter((row) => keys[row.id])
    .map((row) => ({
      value: String(row.id),
      label: row.name || t('Untitled'),
    })), [rows, keys, t]);

  useEffect(() => {
    if (tokenOptions.length === 0) {
      setSelectedTokenId('');
      return;
    }
    if (!tokenOptions.some((option) => option.value === selectedTokenId)) {
      setSelectedTokenId(tokenOptions[0].value);
    }
  }, [tokenOptions, selectedTokenId]);

  const fullKey = keys[selectedTokenId] || 'YOUR_API_KEY';
  const displayKey = fullKey;

  const buildShells = (key: string) => ({
    cmd: {
      label: 'Windows CMD',
      title: 'Command Prompt',
      code: `set ANTHROPIC_BASE_URL=${origin}
set ANTHROPIC_AUTH_TOKEN=${key}
set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
    },
    powershell: {
      label: 'PowerShell',
      title: 'PowerShell',
      code: `$env:ANTHROPIC_BASE_URL="${origin}"
$env:ANTHROPIC_AUTH_TOKEN="${key}"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
    },
    unix: {
      label: 'macOS / Linux',
      title: 'Terminal',
      code: `export ANTHROPIC_BASE_URL="${origin}"
export ANTHROPIC_AUTH_TOKEN="${key}"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
    },
  });

  const shells = useMemo(() => buildShells(displayKey), [origin, displayKey]);
  const copyShells = useMemo(() => buildShells(fullKey), [origin, fullKey]);

  const buildClaudeSettings = (key: string) => `{
  "env": {
    "ANTHROPIC_BASE_URL": "${origin}",
    "ANTHROPIC_AUTH_TOKEN": "${key}",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  }
}`;

  const buildCodexEnv = (key: string) => `set HYXWARE_API_KEY=${key}`;
  const codexConfig = `model_provider = "hyxware"

[model_providers.hyxware]
name = "Hyxware"
base_url = "${origin}/v1"
env_key = "HYXWARE_API_KEY"
wire_api = "responses"`;
  const claudeSettings = buildClaudeSettings(displayKey);
  const fullClaudeSettings = buildClaudeSettings(fullKey);
  const codexEnv = buildCodexEnv(displayKey);
  const fullCodexEnv = buildCodexEnv(fullKey);

  const TOOLS = [
    { key: 'claude', label: 'Claude Code' },
    { key: 'codex', label: 'Codex' },
  ];

  const tabBtn = (active: boolean): CSSProperties => ({
    cursor: 'pointer', height: 28, paddingInline: 12, borderRadius: 14,
    fontSize: 13, border: 'none',
    color: active ? 'var(--ui-text)' : 'var(--ui-text-2)',
    background: active ? 'var(--ui-bg-subtle)' : 'transparent',
    transition: 'background 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>{t('Usage examples')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {TOOLS.map((tl) => (
            <button key={tl.key} onClick={() => setTool(tl.key)} style={tabBtn(tool === tl.key)}>{tl.label}</button>
          ))}
          {tokenOptions.length > 0 && (
            <Select
              value={selectedTokenId}
              onChange={(value) => { setSelectedTokenId(value); setShowKey(false); }}
              options={tokenOptions}
              size={28}
              width={140}
            />
          )}
        </div>
      </div>

      <p style={{ fontSize: 14, color: 'var(--ui-text-3)', margin: 0 }}>
        {t('Configure your API key using these environment variables in your terminal or shell configuration file.')}</p>

      {tool === 'claude' ? (
        <>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Object.entries(shells).map(([k, s]) => (
              <button key={k} onClick={() => setShell(k as 'cmd' | 'powershell' | 'unix')} style={tabBtn(shell === k)}>{s.label}</button>
            ))}
          </div>
          <CodeBlock code={shells[shell].code} copyText={copyShells[shell].code} sensitiveText={fullKey} revealSensitive={showKey} onContentClick={() => setShowKey((value) => !value)} language='bash' title={shells[shell].title} />

          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ui-text)', marginTop: 4 }}>VSCode Claude Code</div>
          <CodeBlock code={claudeSettings} copyText={fullClaudeSettings} sensitiveText={fullKey} revealSensitive={showKey} onContentClick={() => setShowKey((value) => !value)} language='json' title='~/.claude/settings.json' />
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--ui-text-3)', margin: 0 }}>
            {t('Set the key in Windows CMD, then add the provider configuration to ~/.codex/config.toml.')}</p>
          <CodeBlock code={codexEnv} copyText={fullCodexEnv} sensitiveText={fullKey} revealSensitive={showKey} onContentClick={() => setShowKey((value) => !value)} language='bash' title='Windows CMD' />
          <CodeBlock code={codexConfig} language='toml' title='~/.codex/config.toml' />
        </>
      )}

      <p style={{ fontSize: 12, color: 'var(--ui-text-3)', margin: 0 }}>
        {t('These variables apply to the current terminal session. Add them to ~/.bashrc, ~/.zshrc or your shell configuration to persist them.')}</p>
    </div>
  );
};


export default CodeSamples;
