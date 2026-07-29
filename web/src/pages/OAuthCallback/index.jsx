import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

const OAuthCallback = () => {
  const { provider } = useParams();

  useEffect(() => {
    const safeProvider = encodeURIComponent(provider || '');
    window.location.replace(`/api/oauth/${safeProvider}${window.location.search}`);
  }, [provider]);

  return <div className='oauth-callback-page'>正在完成登录...</div>;
};

export default OAuthCallback;
