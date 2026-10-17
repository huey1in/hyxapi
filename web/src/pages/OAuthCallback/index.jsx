import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { API, setUserData, updateAPI } from '../../helpers';
import { UserContext } from '../../context/User';

const OAuthCallback = () => {
  const { provider } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [, dispatch] = useContext(UserContext);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const safeProvider = encodeURIComponent(provider || '');
    setError('');
    (async () => {
      try {
        const response = await API.get(`/api/oauth/${safeProvider}${search}`, { skipErrorHandler: true });
        if (!active) return;
        const body = response?.data;
        if (!body?.success || !body?.data) throw new Error(body?.message || '登录失败，请重试');
        if (body.data.action === 'bind') {
          navigate('/console/personal', { replace: true });
          return;
        }
        if (!body.data.id) throw new Error('登录失败，请重试');
        setUserData(body.data);
        updateAPI();
        dispatch({ type: 'login', payload: body.data });
        navigate('/console', { replace: true });
      } catch (err) {
        if (active) setError(err?.response?.data?.message || err.message || '登录失败，请重试');
      }
    })();
    return () => { active = false; };
  }, [provider, search, navigate, dispatch]);

  return (
    <div className='oauth-callback-page'>
      {error ? <><p role='alert'>{error}</p><Link to='/auth?mode=login'>返回登录</Link></> : '正在完成登录...'}
    </div>
  );
};

export default OAuthCallback;
