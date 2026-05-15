import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLoginModal } from '../../context/LoginModal';

const Register = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { openLoginModal } = useLoginModal();

  useEffect(() => {
    const aff = searchParams.get('aff');
    if (aff) localStorage.setItem('aff', aff);
    openLoginModal('register');
    navigate('/', { replace: true });
  }, []);

  return null;
};

export default Register;
