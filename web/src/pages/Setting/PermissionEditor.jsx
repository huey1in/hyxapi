import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { API, showError, showSuccess, isRoot } from '../../helpers';
import {
  Button, IconButton, Select, Switch, Loading, EmptyState, Tag,
} from '../../components/ui';

// 后端 catalog 返回的是英文 label_key（非 i18n key），此处映射为中文展示，
// 未命中的项回退为英文原文。
const LABEL_ZH = {
  'Channel Management': '渠道管理',
  'Read channels': '查看渠道',
  'Operate channels': '操作渠道',
  'Edit channel routing': '编辑渠道路由',
  'Edit sensitive channel settings': '编辑敏感渠道设置',
  'View channel secrets': '查看渠道密钥',
};

const DESC_ZH = {
  'View channel lists and details without secrets.': '查看渠道列表与详情（不含密钥）。',
  'Test channels, refresh balances, and enable/disable individual, batch, or tagged channels.': '测试渠道、刷新余额，以及启用/禁用单个、批量或带标签的渠道。',
  'Edit non-sensitive settings such as models, groups, and routing rules.': '编辑非敏感设置，如模型、分组与路由规则。',
  'Create channels or edit keys, base URLs, and overrides.': '创建渠道或编辑密钥、Base URL 与覆盖项。',
  'Reserved for viewing complete channel keys after secure verification.': '保留用于在安全验证后查看完整渠道密钥。',
};

const tr = (key, fallback = '') => LABEL_ZH[key] || key || fallback;
const trDesc = (key, fallback = '') => DESC_ZH[key] || key || fallback;

const ADMIN_ROLE = 10;

const PermissionEditor = () => {
  const root = isRoot();
  const [catalog, setCatalog] = useState({ resources: [], roles: [] });
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [permissions, setPermissions] = useState({});
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await API.get('/api/authz/catalog');
      const { success, data, message } = res.data || {};
      if (success) setCatalog({ resources: data?.resources || [], roles: data?.roles || [] });
      else showError(message);
    } catch (e) { showError(e); }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await API.get('/api/user/?p=1&page_size=200');
      const { success, data, message } = res.data || {};
      if (success) setUsers((data?.items || []).filter((u) => u.role === ADMIN_ROLE));
      else showError(message);
    } catch (e) { showError(e); }
  }, []);

  useEffect(() => {
    if (!root) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      await Promise.all([loadCatalog(), loadUsers()]);
      setLoading(false);
    })();
  }, [root, loadCatalog, loadUsers]);

  const loadPermissions = useCallback(async (id) => {
    if (!id) { setPermissions({}); setOverrides({}); setDirty(false); return; }
    setLoadingPerms(true);
    try {
      const res = await API.get(`/api/authz/user/${id}/permissions`);
      const { success, data, message } = res.data || {};
      if (success) {
        setPermissions(data?.permissions || {});
        setOverrides(data?.overrides || {});
        setDirty(false);
      } else showError(message);
    } catch (e) { showError(e); } finally { setLoadingPerms(false); }
  }, []);

  const adminBaseline = useMemo(() => {
    const admin = catalog.roles.find((r) => r.key === 'admin');
    return admin?.grants || {};
  }, [catalog.roles]);

  const userOptions = useMemo(() => (
    users.map((u) => ({ value: String(u.id), label: `#${u.id} ${u.username}` }))
  ), [users]);

  const toggle = (resource, action) => {
    const current = permissions?.[resource]?.[action];
    const baseline = adminBaseline?.[resource]?.[action] ?? false;
    const next = current === undefined ? !baseline : !current;
    setPermissions((p) => ({
      ...p,
      [resource]: { ...(p[resource] || {}), [action]: next },
    }));
    setDirty(true);
  };

  const save = async () => {
    if (!selectedId) return showError('请先选择管理员');
    setSaving(true);
    try {
      const res = await API.put(`/api/authz/user/${selectedId}/permissions`, { permissions });
      const { success, message } = res.data || {};
      if (success) { showSuccess('已保存'); await loadPermissions(selectedId); }
      else showError(message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  if (!root) {
    return (
      <EmptyState icon={ShieldCheck} title='无权访问' description='仅超级管理员可编辑权限' />
    );
  }

  if (loading) return <Loading />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
      {/* 选择目标管理员 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>选择管理员</div>
          <Select
            options={userOptions}
            value={selectedId}
            onChange={(v) => { setSelectedId(v); loadPermissions(v); }}
            placeholder='选择要编辑权限的管理员'
            width='100%'
          />
        </div>
        <Button
          icon={Save}
          loading={saving}
          disabled={!selectedId || !dirty}
          onClick={save}
        >
          保存权限{dirty ? '' : ''}
        </Button>
        <IconButton icon={RefreshCw} title='刷新' onClick={() => loadPermissions(selectedId)} />
      </div>

      {!selectedId ? (
        <div style={{ padding: '40px 20px', border: '1px solid #e9e9e9', borderRadius: 26, textAlign: 'center' }}>
          <span style={{ fontSize: 14, color: '#999' }}>请先选择一名管理员以编辑其渠道权限</span>
        </div>
      ) : loadingPerms ? <Loading /> : (
        catalog.resources.map((res) => (
          <div key={res.resource} style={{ padding: '20px 22px', border: '1px solid #e9e9e9', borderRadius: 26 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#000', marginBottom: 4 }}>{tr(res.label_key, res.resource)}</div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
              管理员默认：查看/操作/编辑路由 允许；敏感设置与查看密钥 拒绝。开启或关闭某项即生成对该用户的覆盖。
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(res.actions || []).map((action) => {
                const checked = permissions?.[res.resource]?.[action.action]
                  ?? adminBaseline?.[res.resource]?.[action.action]
                  ?? false;
                const isOverride = Object.prototype.hasOwnProperty.call(
                  overrides?.[res.resource] || {}, action.action,
                );
                return (
                  <div
                    key={action.action}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 16, padding: '12px 14px', border: '1px solid #eeeeee', borderRadius: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className='flex items-center gap-2'>
                        <span style={{ fontSize: 14, color: '#080808' }}>{tr(action.label_key, action.action)}</span>
                        {isOverride && <Tag color='blue'>覆盖</Tag>}
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>{trDesc(action.description_key)}</div>
                    </div>
                    <Switch size='sm' checked={checked} onChange={() => toggle(res.resource, action.action)} />
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PermissionEditor;
