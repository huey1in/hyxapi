import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageLayout from './components/layout/PageLayout';
import LegacyLogRedirect from './pages/Log/LegacyLogRedirect';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Channel = lazy(() => import('./pages/Channel'));
const Metadata = lazy(() => import('./features/metadata'));
const Token = lazy(() => import('./pages/Token'));
const Log = lazy(() => import('./pages/Log'));
const User = lazy(() => import('./pages/User'));
const Redemption = lazy(() => import('./pages/Redemption'));
const Subscription = lazy(() => import('./pages/Subscription'));
const TopUp = lazy(() => import('./pages/TopUp'));
const MySubscription = lazy(() => import('./pages/MySubscription'));
const Setting = lazy(() => import('./pages/Setting'));
const Operations = lazy(() => import('./pages/Operations'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const SystemStatus = lazy(() => import('./pages/SystemStatus'));
const Setup = lazy(() => import('./pages/Setup'));
const Personal = lazy(() => import('./pages/Personal'));
const Notices = lazy(() => import('./pages/Notices'));
const Forbidden = lazy(() => import('./pages/Forbidden'));
const PasswordReset = lazy(() => import('./pages/PasswordReset'));
const Pricing = lazy(() => import('./pages/Pricing'));
const PricingDetail = lazy(() => import('./pages/Pricing/Detail'));
const Home = lazy(() => import('./pages/Home'));
const Auth = lazy(() => import('./pages/Auth'));
const PublicDocument = lazy(() => import('./features/public-pages/PublicDocument'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));

const App = () => (
  <Routes>
    <Route element={<PageLayout />}>
      <Route path='/'                   element={<Home />} />
      <Route path='/auth'               element={<Auth />} />
      <Route path='/oauth/:provider'    element={<OAuthCallback />} />
      <Route path='/setup'              element={<Setup />} />
      <Route path='/user/reset'         element={<PasswordReset />} />
      <Route path='/forbidden'          element={<Forbidden />} />
      <Route path='/user-agreement' element={<PublicDocument kind='terms' />} />
      <Route path='/privacy-policy' element={<PublicDocument kind='privacy' />} />
      <Route path='/pricing'            element={<Pricing />} />
      <Route path='/pricing/model/*'    element={<PricingDetail />} />

      <Route path='/console'                  element={<Dashboard />} />
      <Route path='/console/pricing'          element={<Pricing />} />
      <Route path='/console/pricing/model/*'  element={<PricingDetail />} />
      <Route path='/console/channel'          element={<Channel />} />
      <Route path='/console/models'           element={<Metadata />} />
      <Route path='/console/vendors'          element={<Metadata kind='vendors' />} />
      <Route path='/console/token'            element={<Token />} />
      <Route path='/console/log'              element={<Log />} />
      <Route path='/console/task'             element={<LegacyLogRedirect tab='tasks' />} />
      <Route path='/console/midjourney'       element={<LegacyLogRedirect tab='midjourney' />} />
      <Route path='/console/user'             element={<User />} />
      <Route path='/console/operations'       element={<Operations />} />
      <Route path='/console/audit'            element={<AuditLog />} />
      <Route path='/console/system-status'    element={<SystemStatus />} />
      <Route path='/console/redemption'       element={<Redemption />} />
      <Route path='/console/subscription'     element={<Subscription />} />
      <Route path='/console/topup'            element={<TopUp />} />
      <Route path='/console/my-subscription'  element={<MySubscription />} />
      <Route path='/console/setting'          element={<Setting />} />
      <Route path='/console/personal'         element={<Personal />} />
      <Route path='/console/notices'          element={<Notices />} />

      <Route path='*' element={<Navigate to='/' replace />} />
    </Route>
  </Routes>
);

export default App;
