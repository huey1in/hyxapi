import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageLayout from './components/layout/PageLayout';
import LegacyLogRedirect from './pages/Log/LegacyLogRedirect';
import ClientRouteRedirect from './components/layout/ClientRouteRedirect';
import { CLIENT_ROUTE_REDIRECTS } from './lib/console-routes';

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
const Tickets = lazy(() => import('./pages/Tickets'));
const Notices = lazy(() => import('./pages/Notices'));
const Forbidden = lazy(() => import('./pages/Forbidden'));
const PasswordReset = lazy(() => import('./pages/PasswordReset'));
const Pricing = lazy(() => import('./pages/Pricing'));
const PricingDetail = lazy(() => import('./pages/Pricing/Detail'));
const Auth = lazy(() => import('./pages/Auth'));
const PublicDocument = lazy(() => import('./features/public-pages/PublicDocument'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));

const App = () => (
  <Routes>
    {/* TODO: 首页暂未完成设计，保留 pages/Home，完成设计后恢复路由。 */}
    <Route path='/' element={<Navigate to='/console' replace />} />
    <Route path='/index.html' element={<Navigate to='/console' replace />} />
    {Object.keys(CLIENT_ROUTE_REDIRECTS).map((path) => <Route key={path} path={`${path}/*`} element={<ClientRouteRedirect />} />)}
    <Route path='/console/task' element={<LegacyLogRedirect />} />
    <Route path='/console/midjourney' element={<LegacyLogRedirect />} />
    <Route element={<PageLayout />}>
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
      <Route path='/console/channel'          element={<Channel />} />
      <Route path='/console/models'           element={<Metadata />} />
      <Route path='/console/vendors'          element={<Metadata kind='vendors' />} />
      <Route path='/token'                    element={<Token />} />
      <Route path='/log'                      element={<Log />} />
      <Route path='/console/user'             element={<User />} />
      <Route path='/console/operations'       element={<Operations />} />
      <Route path='/console/audit'            element={<AuditLog />} />
      <Route path='/console/system-status'    element={<SystemStatus />} />
      <Route path='/console/redemption'       element={<Redemption />} />
      <Route path='/console/subscription'     element={<Subscription />} />
      <Route path='/topup'                    element={<TopUp />} />
      <Route path='/subscription'             element={<MySubscription />} />
      <Route path='/console/setting'          element={<Setting />} />
      <Route path='/personal'                 element={<Personal />} />
      <Route path='/tickets' element={<Tickets />} />
      <Route path='/console/tickets' element={<Tickets management />} />
      <Route path='/notices'                  element={<Notices />} />

      <Route path='*' element={<Navigate to='/' replace />} />
    </Route>
  </Routes>
);

export default App;
