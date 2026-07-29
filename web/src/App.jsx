import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageLayout from './components/layout/PageLayout';

import Dashboard     from './pages/Dashboard';
import Channel       from './pages/Channel';
import Token         from './pages/Token';
import Log           from './pages/Log';
import User          from './pages/User';
import Redemption    from './pages/Redemption';
import Subscription  from './pages/Subscription';
import TopUp         from './pages/TopUp';
import MySubscription from './pages/MySubscription';
// import Chat         from './pages/Chat';
import Setting       from './pages/Setting';
import Operations    from './pages/Operations';
import AuditLog      from './pages/AuditLog';
import SystemStatus  from './pages/SystemStatus';
import Setup         from './pages/Setup';
import Personal      from './pages/Personal';
import Notices       from './pages/Notices';
import Forbidden     from './pages/Forbidden';
import PasswordReset from './pages/PasswordReset';
import Register     from './pages/Register';
import Pricing      from './pages/Pricing';
import PricingDetail from './pages/Pricing/Detail';
import Home from './pages/Home';
import Auth from './pages/Auth';

const App = () => (
  <Routes>
    <Route element={<PageLayout />}>
      <Route path='/'                   element={<Home />} />
      <Route path='/auth'               element={<Auth />} />
      <Route path='/setup'              element={<Setup />} />
      <Route path='/user/reset'         element={<PasswordReset />} />
      <Route path='/register'           element={<Register />} />
      <Route path='/forbidden'          element={<Forbidden />} />
      <Route path='/pricing'            element={<Pricing />} />
      <Route path='/pricing/model/*'    element={<PricingDetail />} />

      <Route path='/console'                  element={<Dashboard />} />
      <Route path='/console/pricing'          element={<Pricing />} />
      <Route path='/console/pricing/model/*'  element={<PricingDetail />} />
      <Route path='/console/channel'          element={<Channel />} />
      <Route path='/console/token'            element={<Token />} />
      <Route path='/console/log'              element={<Log />} />
      <Route path='/console/user'             element={<User />} />
      <Route path='/console/operations'       element={<Operations />} />
      <Route path='/console/audit'            element={<AuditLog />} />
      <Route path='/console/system-status'    element={<SystemStatus />} />
      <Route path='/console/redemption'       element={<Redemption />} />
      <Route path='/console/subscription'     element={<Subscription />} />
      <Route path='/console/topup'            element={<TopUp />} />
      <Route path='/console/my-subscription'  element={<MySubscription />} />
      {/* <Route path='/console/chat'             element={<Chat />} /> */}
      <Route path='/console/setting'          element={<Setting />} />
      <Route path='/console/personal'         element={<Personal />} />
      <Route path='/console/notices'          element={<Notices />} />

      <Route path='*' element={<Navigate to='/' replace />} />
    </Route>
  </Routes>
);

export default App;
