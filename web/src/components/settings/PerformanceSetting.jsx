/*
 * 性能 wrapper — page-bg + rounded-[20px] style.
 */

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import SettingsPerformance from '../../pages/Setting/Performance/SettingsPerformance';
import { API, showError, toBoolean } from '../../helpers';
import { Card } from '../ui';

const PerformanceSetting = ({ registerRefresh }) => {
  let [inputs, setInputs] = useState({
    'performance_setting.disk_cache_enabled': false,
    'performance_setting.disk_cache_threshold_mb': 10,
    'performance_setting.disk_cache_max_size_mb': 1024,
    'performance_setting.disk_cache_path': '',
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (typeof inputs[item.key] === 'boolean') {
          newInputs[item.key] = toBoolean(item.value);
        } else {
          newInputs[item.key] = item.value;
        }
      });
      setInputs(newInputs);
    } else {
      showError(message);
    }
  };

  async function onRefresh() {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError('刷新失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    onRefresh();
    registerRefresh?.(onRefresh);
  }, []); // eslint-disable-line

  return (
    <div className='relative'>
      {loading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-[var(--page-bg)]/60 rounded-[20px]'>
          <Loader2 size={20} className='animate-spin text-ui-text-3' />
        </div>
      )}
      <Card variant='plain' padding='lg' radius='xxl'>
        <SettingsPerformance options={inputs} refresh={onRefresh} />
      </Card>
    </div>
  );
};

export default PerformanceSetting;
