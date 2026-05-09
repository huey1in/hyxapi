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

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import Turnstile from 'react-turnstile';
import ModalDialog from '../../../common/ModalDialog';
import { API, showError, showSuccess, renderQuota } from '../../../../helpers';

const CheckinCalendar = ({ t, status, turnstileEnabled, turnstileSiteKey }) => {
  const [loading, setLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [turnstileModalVisible, setTurnstileModalVisible] = useState(false);
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0);
  const [checkinData, setCheckinData] = useState({
    enabled: false,
    stats: {
      checked_in_today: false,
      total_checkins: 0,
      total_quota: 0,
      checkin_count: 0,
      records: [],
    },
  });
  const [currentMonth, setCurrentMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(null);

  // Map date to quota for quick lookup
  const checkinRecordsMap = useMemo(() => {
    const map = {};
    const records = checkinData.stats?.records || [];
    records.forEach((record) => {
      map[record.checkin_date] = record.quota_awarded;
    });
    return map;
  }, [checkinData.stats?.records]);

  // Calculate monthly quota
  const monthlyQuota = useMemo(() => {
    const records = checkinData.stats?.records || [];
    return records.reduce((sum, record) => sum + (record.quota_awarded || 0), 0);
  }, [checkinData.stats?.records]);

  // Fetch checkin status
  const fetchCheckinStatus = async (month) => {
    const isFirstLoad = !initialLoaded;
    setLoading(true);
    try {
      const res = await API.get(`/api/user/checkin?month=${month}`);
      const { success, data, message } = res.data;
      if (success) {
        setCheckinData(data);
        if (isFirstLoad) {
          setIsCollapsed(data.stats?.checked_in_today ?? false);
          setInitialLoaded(true);
        }
      } else {
        showError(message || t('获取签到状态失败'));
        if (isFirstLoad) { setIsCollapsed(false); setInitialLoaded(true); }
      }
    } catch (error) {
      showError(t('获取签到状态失败'));
      if (isFirstLoad) { setIsCollapsed(false); setInitialLoaded(true); }
    } finally {
      setLoading(false);
    }
  };

  const postCheckin = async (token) => {
    const url = token
      ? `/api/user/checkin?turnstile=${encodeURIComponent(token)}`
      : '/api/user/checkin';
    return API.post(url);
  };

  const shouldTriggerTurnstile = (message) => {
    if (!turnstileEnabled) return false;
    if (typeof message !== 'string') return true;
    return message.includes('Turnstile');
  };

  const doCheckin = async (token) => {
    setCheckinLoading(true);
    try {
      const res = await postCheckin(token);
      const { success, data, message } = res.data;
      if (success) {
        showSuccess(t('签到成功！获得') + ' ' + renderQuota(data.quota_awarded));
        fetchCheckinStatus(currentMonth);
        setTurnstileModalVisible(false);
      } else {
        if (!token && shouldTriggerTurnstile(message)) {
          if (!turnstileSiteKey) {
            showError('Turnstile is enabled but site key is empty.');
            return;
          }
          setTurnstileModalVisible(true);
          return;
        }
        if (token && shouldTriggerTurnstile(message)) {
          setTurnstileWidgetKey((v) => v + 1);
        }
        showError(message || t('签到失败'));
      }
    } catch (error) {
      showError(t('签到失败'));
    } finally {
      setCheckinLoading(false);
    }
  };

  useEffect(() => {
    if (status?.checkin_enabled) {
      fetchCheckinStatus(currentMonth);
    }
  }, [status?.checkin_enabled, currentMonth]);

  if (!status?.checkin_enabled) {
    return null;
  }

  // Generate calendar grid for current month
  const generateCalendarDays = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0=Sun

    const days = [];
    // Fill empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  };

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
    setCurrentMonth(prev);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    setCurrentMonth(next);
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const calendarDays = generateCalendarDays();
  const weekDays = [t('日'), t('一'), t('二'), t('三'), t('四'), t('五'), t('六')];

  return (
    <div className='border border-ui-border rounded-2xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
      <ModalDialog
        open={turnstileModalVisible}
        onClose={() => {
          setTurnstileModalVisible(false);
          setTurnstileWidgetKey((v) => v + 1);
        }}
        title='Security Check'
        hideFooter
      >
        <div className='flex justify-center py-2'>
          <Turnstile
            key={turnstileWidgetKey}
            sitekey={turnstileSiteKey}
            onVerify={(token) => { doCheckin(token); }}
            onExpire={() => { setTurnstileWidgetKey((v) => v + 1); }}
          />
        </div>
      </ModalDialog>

      {/* Card header */}
      <div className='flex items-center justify-between'>
        <div
          className='flex items-center flex-1 cursor-pointer'
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className='w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center mr-3'>
            <Check size={16} className='text-green-600' />
          </div>
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              <span className='text-lg font-medium text-ui-text'>
                {t('每日签到')}
              </span>
              {isCollapsed ? <ChevronDown size={16} className='text-ui-text-3' /> : <ChevronUp size={16} className='text-ui-text-3' />}
            </div>
            <div className='text-xs text-ui-text-2'>
              {!initialLoaded
                ? t('正在加载签到状态...')
                : checkinData.stats?.checked_in_today
                  ? t('今日已签到，累计签到') + ` ${checkinData.stats?.total_checkins || 0} ` + t('天')
                  : t('每日签到可获得随机额度奖励')}
            </div>
          </div>
        </div>
        <button
          onClick={() => doCheckin()}
          disabled={!initialLoaded || checkinData.stats?.checked_in_today || checkinLoading}
          className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50'
        >
          {(checkinLoading || !initialLoaded) && <Loader2 size={14} className='animate-spin' />}
          {!initialLoaded
            ? t('加载中...')
            : checkinData.stats?.checked_in_today
              ? t('今日已签到')
              : t('立即签到')}
        </button>
      </div>

      {/* Collapsible content */}
      {isCollapsed === false && (
        <>
          {/* Checkin stats */}
          <div className='grid grid-cols-3 gap-3 mb-4 mt-4'>
            <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
              <div className='text-xl font-bold text-green-600'>
                {checkinData.stats?.total_checkins || 0}
              </div>
              <div className='text-xs text-ui-text-2'>{t('累计签到')}</div>
            </div>
            <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
              <div className='text-xl font-bold text-orange-600'>
                {renderQuota(monthlyQuota, 6)}
              </div>
              <div className='text-xs text-ui-text-2'>{t('本月获得')}</div>
            </div>
            <div className='text-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
              <div className='text-xl font-bold text-blue-600'>
                {renderQuota(checkinData.stats?.total_quota || 0, 6)}
              </div>
              <div className='text-xs text-ui-text-2'>{t('累计获得')}</div>
            </div>
          </div>

          {/* Calendar */}
          <div className='relative border border-ui-border rounded-lg overflow-hidden'>
            {loading && (
              <div className='absolute inset-0 bg-white/50 dark:bg-black/30 flex items-center justify-center z-10'>
                <Loader2 size={20} className='animate-spin text-ui-text-3' />
              </div>
            )}
            {/* Month navigation */}
            <div className='flex items-center justify-between px-4 py-2 border-b border-ui-border'>
              <button onClick={handlePrevMonth} className='text-sm text-ui-text-2 hover:text-ui-text px-2 py-1 rounded transition-colors'>
                &lt;
              </button>
              <span className='text-sm font-medium text-ui-text'>{currentMonth}</span>
              <button onClick={handleNextMonth} className='text-sm text-ui-text-2 hover:text-ui-text px-2 py-1 rounded transition-colors'>
                &gt;
              </button>
            </div>
            {/* Week header */}
            <div className='grid grid-cols-7 text-center border-b border-ui-border'>
              {weekDays.map((d) => (
                <div key={d} className='py-1.5 text-xs font-medium text-ui-text-3'>{d}</div>
              ))}
            </div>
            {/* Days grid */}
            <div className='grid grid-cols-7'>
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className='h-14' />;
                const [year, month] = currentMonth.split('-').map(Number);
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const quotaAwarded = checkinRecordsMap[dateStr];
                const isCheckedIn = quotaAwarded !== undefined;
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={dateStr}
                    className='h-14 relative flex flex-col items-center justify-center border-b border-r border-ui-border/30'
                    title={isCheckedIn ? `${t('获得')} ${renderQuota(quotaAwarded)}` : ''}
                  >
                    <span className={`text-xs ${isToday ? 'bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-ui-text-2'}`}>
                      {day}
                    </span>
                    {isCheckedIn && (
                      <>
                        <div className='w-4 h-4 rounded-full bg-green-500 flex items-center justify-center mt-0.5'>
                          <Check size={10} className='text-white' />
                        </div>
                        <div className='text-[9px] font-medium text-green-600 dark:text-green-400 leading-none mt-0.5'>
                          {renderQuota(quotaAwarded)}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkin notes */}
          <div className='mt-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg'>
            <span className='text-xs text-ui-text-2'>
              <ul className='list-disc list-inside space-y-0.5'>
                <li>{t('每日签到可获得随机额度奖励')}</li>
                <li>{t('签到奖励将直接添加到您的账户余额')}</li>
                <li>{t('每日仅可签到一次，请勿重复签到')}</li>
              </ul>
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default CheckinCalendar;
