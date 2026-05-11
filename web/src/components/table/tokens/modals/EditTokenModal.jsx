/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
  getCurrencyConfig,
  getModelCategories,
} from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { Save, X, CreditCard, Link, Key, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../../../context/Status';
import SlideOver from '../../../common/SlideOver';
import {
  FieldRow,
  TextField,
  NumberField,
  TextAreaField,
  Toggle,
  MultiCombobox,
  Combobox,
} from '../../../common/form/Primitives';
import { Button } from '../../../ui';

const SectionCard = ({ icon: Icon, iconColor = 'blue', title, description, children }) => {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  };
  return (
    <div className='border border-ui-border rounded-2xl p-4 mb-4'>
      <div className='flex items-center mb-3'>
        {Icon && (
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mr-2 ${colorMap[iconColor] || colorMap.blue}`}>
            <Icon size={16} />
          </span>
        )}
        <div>
          <div className='text-sm font-semibold text-ui-text'>{title}</div>
          {description && <div className='text-xs text-ui-text-3 mt-0.5'>{description}</div>}
        </div>
      </div>
      <div className='space-y-4'>{children}</div>
    </div>
  );
};

const getInitValues = () => ({
  name: '',
  remain_quota: 0,
  remain_amount: 0,
  expired_time: -1,
  unlimited_quota: true,
  model_limits_enabled: false,
  model_limits: [],
  allow_ips: '',
  group: '',
  cross_group_retry: false,
  tokenCount: 1,
});

const EditTokenModal = (props) => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const [values, setValues] = useState(getInitValues());
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showQuotaInput, setShowQuotaInput] = useState(false);
  const isEdit = props.editingToken.id !== undefined;

  const setValue = (field, val) => setValues((prev) => ({ ...prev, [field]: val }));

  const handleCancel = () => {
    props.handleClose();
  };

  const setExpiredTime = (month, day, hour, minute) => {
    let now = new Date();
    let timestamp = now.getTime() / 1000;
    let seconds = month * 30 * 24 * 60 * 60;
    seconds += day * 24 * 60 * 60;
    seconds += hour * 60 * 60;
    seconds += minute * 60;
    if (seconds !== 0) {
      timestamp += seconds;
      setValue('expired_time', timestamp2string(timestamp));
    } else {
      setValue('expired_time', -1);
    }
  };

  const loadModels = async () => {
    let res = await API.get(`/api/user/models`);
    const { success, message, data } = res.data;
    if (success) {
      const categories = getModelCategories(t);
      let localModelOptions = data.map((model) => {
        let icon = null;
        for (const [key, category] of Object.entries(categories)) {
          if (key !== 'all' && category.filter({ model_name: model })) {
            icon = category.icon;
            break;
          }
        }
        return {
          label: model,
          value: model,
          icon,
        };
      });
      setModels(localModelOptions);
    } else {
      showError(t(message));
    }
  };

  const loadGroups = async () => {
    let res = await API.get(`/api/user/self/groups`);
    const { success, message, data } = res.data;
    if (success) {
      let localGroupOptions = Object.entries(data).map(([group, info]) => ({
        label: info.desc,
        value: group,
        ratio: info.ratio,
      }));
      if (statusState?.status?.default_use_auto_group) {
        if (localGroupOptions.some((group) => group.value === 'auto')) {
          localGroupOptions.sort((a, b) => (a.value === 'auto' ? -1 : 1));
        }
      }
      setGroups(localGroupOptions);
    } else {
      showError(t(message));
    }
  };

  const loadToken = async () => {
    setLoading(true);
    let res = await API.get(`/api/token/${props.editingToken.id}`);
    const { success, message, data } = res.data;
    if (success) {
      if (data.expired_time !== -1) {
        data.expired_time = timestamp2string(data.expired_time);
      }
      if (data.model_limits !== '') {
        data.model_limits = data.model_limits.split(',');
      } else {
        data.model_limits = [];
      }
      data.remain_amount = Number(
        quotaToDisplayAmount(data.remain_quota || 0).toFixed(6),
      );
      setValues({ ...getInitValues(), ...data });
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isEdit) {
      setValues(getInitValues());
    }
    loadModels();
    loadGroups();
  }, [props.editingToken.id]);

  useEffect(() => {
    if (props.visiable) {
      if (isEdit) {
        loadToken();
      } else {
        setValues(getInitValues());
      }
    } else {
      setValues(getInitValues());
    }
  }, [props.visiable, props.editingToken.id]);

  const generateRandomSuffix = () => {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  };

  const submit = async () => {
    setLoading(true);
    if (isEdit) {
      let { tokenCount: _tc, ...localInputs } = values;
      localInputs.remain_quota = localInputs.unlimited_quota
        ? 0
        : displayAmountToQuota(localInputs.remain_amount);
      if (!localInputs.unlimited_quota && localInputs.remain_quota <= 0) {
        showError(t('请输入金额'));
        setLoading(false);
        return;
      }
      if (localInputs.expired_time !== -1) {
        let time = Date.parse(localInputs.expired_time);
        if (isNaN(time)) {
          showError(t('过期时间格式错误！'));
          setLoading(false);
          return;
        }
        localInputs.expired_time = Math.ceil(time / 1000);
      }
      localInputs.model_limits = Array.isArray(localInputs.model_limits)
        ? localInputs.model_limits.join(',')
        : '';
      localInputs.model_limits_enabled = localInputs.model_limits.length > 0;
      let res = await API.put(`/api/token/`, {
        ...localInputs,
        id: parseInt(props.editingToken.id),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('令牌更新成功！'));
        props.refresh();
        props.handleClose();
      } else {
        showError(t(message));
      }
    } else {
      const count = parseInt(values.tokenCount, 10) || 1;
      let successCount = 0;
      for (let i = 0; i < count; i++) {
        let { tokenCount: _tc, ...localInputs } = values;
        const baseName =
          values.name.trim() === '' ? 'default' : values.name.trim();
        if (i !== 0 || values.name.trim() === '') {
          localInputs.name = `${baseName}-${generateRandomSuffix()}`;
        } else {
          localInputs.name = baseName;
        }
        localInputs.remain_quota = localInputs.unlimited_quota
          ? 0
          : displayAmountToQuota(localInputs.remain_amount);
        if (!localInputs.unlimited_quota && localInputs.remain_quota <= 0) {
          showError(t('请输入金额'));
          setLoading(false);
          break;
        }

        if (localInputs.expired_time !== -1) {
          let time = Date.parse(localInputs.expired_time);
          if (isNaN(time)) {
            showError(t('过期时间格式错误！'));
            setLoading(false);
            break;
          }
          localInputs.expired_time = Math.ceil(time / 1000);
        }
        localInputs.model_limits = Array.isArray(localInputs.model_limits)
          ? localInputs.model_limits.join(',')
          : '';
        localInputs.model_limits_enabled = localInputs.model_limits.length > 0;
        let res = await API.post(`/api/token/`, localInputs);
        const { success, message } = res.data;
        if (success) {
          successCount++;
        } else {
          showError(t(message));
          break;
        }
      }
      if (successCount > 0) {
        showSuccess(t('令牌创建成功，请在列表页面点击复制获取令牌！'));
        props.refresh();
        props.handleClose();
      }
    }
    setLoading(false);
    setValues(getInitValues());
  };

  return (
    <SlideOver
      open={props.visiable}
      onClose={handleCancel}
      placement={isEdit ? 'right' : 'left'}
      width={isMobile ? '100%' : 600}
      title={
        <div className='flex items-center gap-2'>
          {isEdit ? (
            <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400'>
              {t('更新')}
            </span>
          ) : (
            <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'>
              {t('新建')}
            </span>
          )}
          <span className='text-base font-semibold text-ui-text'>
            {isEdit ? t('更新令牌信息') : t('创建新的令牌')}
          </span>
        </div>
      }
      footer={
        <>
          <Button
            icon={loading ? Loader2 : Save}
            onClick={submit}
            disabled={loading}
          >
            {t('提交')}
          </Button>
          <Button
            variant='secondary'
            icon={X}
            onClick={handleCancel}
          >
            {t('取消')}
          </Button>
        </>
      }
    >
      {loading && (
        <div className='flex items-center justify-center py-8'>
          <Loader2 size={20} className='animate-spin text-ui-text-3' />
        </div>
      )}
      {!loading && (
        <div className='p-4 space-y-4'>
          {/* 基本信息 */}
          <SectionCard icon={Key} iconColor='blue' title={t('基本信息')} description={t('设置令牌的基本信息')}>
            <FieldRow label={t('名称')} required>
              <TextField
                value={values.name}
                onChange={(v) => setValue('name', v)}
                placeholder={t('请输入名称')}
              />
            </FieldRow>

            {groups.length > 0 ? (
              <FieldRow label={t('令牌分组')}>
                <Combobox
                  value={values.group}
                  onChange={(v) => setValue('group', v)}
                  options={groups}
                  placeholder={t('令牌分组，默认为用户的分组')}
                />
              </FieldRow>
            ) : (
              <FieldRow label={t('令牌分组')}>
                <TextField
                  disabled
                  placeholder={t('管理员未设置用户可选分组')}
                />
              </FieldRow>
            )}

            {values.group === 'auto' && (
              <FieldRow label={t('跨分组重试')} hint={t('开启后，当前分组渠道失败时会按顺序尝试下一个分组的渠道')}>
                <Toggle
                  checked={values.cross_group_retry}
                  onChange={(v) => setValue('cross_group_retry', v)}
                />
              </FieldRow>
            )}

            <FieldRow label={t('过期时间')}>
              <TextField
                value={values.expired_time === -1 ? '' : values.expired_time}
                onChange={(v) => setValue('expired_time', v || -1)}
                placeholder={t('请选择过期时间')}
              />
            </FieldRow>

            <FieldRow label={t('过期时间快捷设置')}>
              <div className='flex flex-wrap gap-2'>
                <Button size='sm' onClick={() => setExpiredTime(0, 0, 0, 0)}>
                  {t('永不过期')}
                </Button>
                <Button size='sm' variant='secondary' onClick={() => setExpiredTime(1, 0, 0, 0)}>
                  {t('一个月')}
                </Button>
                <Button size='sm' variant='secondary' onClick={() => setExpiredTime(0, 1, 0, 0)}>
                  {t('一天')}
                </Button>
                <Button size='sm' variant='secondary' onClick={() => setExpiredTime(0, 0, 1, 0)}>
                  {t('一小时')}
                </Button>
              </div>
            </FieldRow>

            {!isEdit && (
              <FieldRow label={t('新建数量')} hint={t('批量创建时会在名称后自动添加随机后缀')}>
                <NumberField
                  value={values.tokenCount}
                  onChange={(v) => setValue('tokenCount', v)}
                  min={1}
                />
              </FieldRow>
            )}
          </SectionCard>

          {/* 额度设置 */}
          <SectionCard icon={CreditCard} iconColor='green' title={t('额度设置')} description={t('设置令牌可用额度和数量')}>
            <FieldRow label={t('金额')}>
              <div className='flex items-center gap-2'>
                <span className='text-sm text-ui-text-2'>{getCurrencyConfig().symbol}</span>
                <NumberField
                  value={values.remain_amount}
                  onChange={(val) => {
                    const amount = val === '' || val == null ? 0 : val;
                    setValue('remain_amount', amount);
                    setValue('remain_quota', displayAmountToQuota(amount));
                  }}
                  min={0}
                  step={0.000001}
                  disabled={values.unlimited_quota}
                  className='flex-1'
                />
              </div>
            </FieldRow>

            <div>
              <Button
                variant='link'
                size='sm'
                className='text-ui-text-2 hover:no-underline'
                onClick={() => setShowQuotaInput((v) => !v)}
              >
                {showQuotaInput
                  ? `▾ ${t('收起原生额度输入')}`
                  : `▸ ${t('使用原生额度输入')}`}
              </Button>
              {showQuotaInput && (
                <div className='mt-2'>
                  <FieldRow label={t('额度')}>
                    <NumberField
                      value={values.remain_quota}
                      onChange={(val) => {
                        const quota = val === '' || val == null ? 0 : val;
                        setValue('remain_quota', quota);
                        setValue('remain_amount', Number(quotaToDisplayAmount(quota).toFixed(6)));
                      }}
                      min={0}
                      step={500000}
                      disabled={values.unlimited_quota}
                    />
                  </FieldRow>
                </div>
              )}
            </div>

            <FieldRow label={t('无限额度')} hint={t('令牌的额度仅用于限制令牌本身的最大额度使用量，实际的使用受到账户的剩余额度限制')}>
              <Toggle
                checked={values.unlimited_quota}
                onChange={(v) => setValue('unlimited_quota', v)}
              />
            </FieldRow>
          </SectionCard>

          {/* 访问限制 */}
          <SectionCard icon={Link} iconColor='purple' title={t('访问限制')} description={t('设置令牌的访问限制')}>
            <FieldRow label={t('模型限制列表')} hint={t('非必要，不建议启用模型限制')}>
              <MultiCombobox
                value={values.model_limits || []}
                onChange={(v) => setValue('model_limits', v)}
                options={models}
                placeholder={t('请选择该令牌支持的模型，留空支持所有模型')}
              />
            </FieldRow>

            <FieldRow label={t('IP白名单（支持CIDR表达式）')} hint={t('请勿过度信任此功能，IP可能被伪造，请配合nginx和cdn等网关使用')}>
              <TextAreaField
                value={values.allow_ips}
                onChange={(v) => setValue('allow_ips', v)}
                placeholder={t('允许的IP，一行一个，不填写则不限制')}
                rows={2}
              />
            </FieldRow>
          </SectionCard>
        </div>
      )}
    </SlideOver>
  );
};

export default EditTokenModal;
