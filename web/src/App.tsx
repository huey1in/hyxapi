import { lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import PageLayout from './components/layout/PageLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Channel = lazy(() => import('./pages/Channel'));
const Metadata = lazy(() => import('./features/metadata'));
const Deployment = lazy(() => import('./features/deployment'));
const Token = lazy(() => import('./pages/Token'));
const Log = lazy(() => import('./pages/Log'));
const Task = lazy(() => import('./pages/Task'));
const Midjourney = lazy(() => import('./pages/Task/Midjourney'));
const Playground = lazy(() => import('./features/playground'));
const ChatClients = lazy(() => import('./features/chat'));
const ChatPage = lazy(() => import('./features/chat/ChatPage'));
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
const Rankings = lazy(() => import('./features/public-pages/Rankings'));
const PublicDocument = lazy(() => import('./features/public-pages/PublicDocument'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));

const LegacyChatRedirect = () => {
  const { chatId } = useParams();
  return <Navigate to={`/console/chat/${encodeURIComponent(chatId || '')}`} replace />;
};

const App = () => (
  <Routes>
    <Route element={<PageLayout />}>
      <Route path='/'                   element={<Home />} />
      <Route path='/auth'               element={<Auth />} />
      <Route path='/oauth/:provider'    element={<OAuthCallback />} />
      <Route path='/setup'              element={<Setup />} />
      <Route path='/user/reset'         element={<PasswordReset />} />
      <Route path='/forbidden'          element={<Forbidden />} />
      <Route path='/rankings' element={<Rankings />} />
      <Route path='/about' element={<PublicDocument kind='about' />} />
      <Route path='/user-agreement' element={<PublicDocument kind='terms' />} />
      <Route path='/privacy-policy' element={<PublicDocument kind='privacy' />} />
      <Route path='/pricing'            element={<Pricing />} />
      <Route path='/pricing/model/*'    element={<PricingDetail />} />
      <Route path='/chat/:chatId'       element={<LegacyChatRedirect />} />
      <Route path='/chat2link'          element={<Navigate to='/console/chat2link' replace />} />

      <Route path='/console'                  element={<Dashboard />} />
      <Route path='/console/pricing'          element={<Pricing />} />
      <Route path='/console/pricing/model/*'  element={<PricingDetail />} />
      <Route path='/console/channel'          element={<Channel />} />
      <Route path='/console/models'           element={<Metadata />} />
      <Route path='/console/vendors'          element={<Metadata kind='vendors' />} />
      <Route path='/console/deployments'      element={<Deployment />} />
      <Route path='/console/token'            element={<Token />} />
      <Route path='/console/log'              element={<Log />} />
      <Route path='/console/task'             element={<Task />} />
      <Route path='/console/midjourney'       element={<Midjourney />} />
      <Route path='/console/playground'      element={<Playground />} />
      <Route path='/console/chat'            element={<ChatClients />} />
      <Route path='/console/chat/:chatId'    element={<ChatPage />} />
      <Route path='/console/chat2link'       element={<ChatPage redirect />} />
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
