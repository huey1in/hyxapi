/*
 * OAuth2Callback — 与 web-backup 同构。
 *
 * 处理 /oauth/<provider>?code=&state= 的回调，调用 /api/oauth/<provider>
 * 完成 OAuth 登录或绑定流程。
 */

import React, { useContext, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, updateAPI, setUserData } from '../../../helpers';
import { UserContext } from '../../../context/User';
import { Loading } from '../../ui';

const MAX_RETRIES = 3;

const OAuth2Callback = ({ type }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [, userDispatch] = useContext(UserContext);
  const navigate = useNavigate();
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) return;
    hasExecuted.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code) {
      showError(t('未收到授权码'));
      navigate('/');
      return;
    }

    const sendCode = async (retry = 0) => {
      try {
        const { data: resData } = await API.get(`/api/oauth/${type}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`);
        const { success, message, data } = resData || {};
        if (!success) { showError(message || t('授权失败')); return; }
        if (data?.action === 'bind') {
          showSuccess(t('绑定成功！'));
          navigate('/console/personal');
        } else {
          userDispatch({ type: 'login', payload: data });
          setUserData(data);
          updateAPI?.();
          showSuccess(t('登录成功！'));
          navigate('/console/token');
        }
      } catch (e) {
        if (retry < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, (retry + 1) * 2000));
          return sendCode(retry + 1);
        }
        showError(e.message || t('授权失败'));
        navigate('/');
      }
    };

    sendCode();
  }, [searchParams, type, navigate, userDispatch, t]);

  return (
    <div className='min-h-screen flex items-center justify-center' style={{ backgroundColor: 'var(--page-bg)' }}>
      <Loading label={t('处理授权中...')} />
    </div>
  );
};

export default OAuth2Callback;
