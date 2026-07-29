import { Navigate, useSearchParams } from 'react-router-dom';

const Register = () => {
  const [params] = useSearchParams();
  const aff = params.get('aff');
  if (aff) localStorage.setItem('aff', aff);
  return <Navigate to='/auth?mode=register' replace />;
};

export default Register;
