import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageLayout from './components/layout/PageLayout';

import Home          from './pages/Home';
import Dashboard     from './pages/Dashboard';
import Channel       from './pages/Channel';
import Token         from './pages/Token';
import Log           from './pages/Log';
import User          from './pages/User';
import Redemption    from './pages/Redemption';
import Subscription  from './pages/Subscription';
import TopUp         from './pages/TopUp';
// import Chat         from './pages/Chat';
import Pricing       from './pages/Pricing';
import Setting       from './pages/Setting';
import Setup         from './pages/Setup';
import Personal      from './pages/Personal';
import Forbidden     from './pages/Forbidden';
import PrivacyPolicy from './pages/PrivacyPolicy';
import UserAgreement from './pages/UserAgreement';
import PasswordReset from './pages/PasswordReset';

const App = () => (
  <Routes>
    <Route element={<PageLayout />}>
      <Route path='/'                   element={<Home />} />
      <Route path='/pricing'            element={<Pricing />} />
      <Route path='/privacy'            element={<PrivacyPolicy />} />
      <Route path='/agreement'          element={<UserAgreement />} />
      <Route path='/setup'              element={<Setup />} />
      <Route path='/user/reset'         element={<PasswordReset />} />
      <Route path='/forbidden'          element={<Forbidden />} />

      <Route path='/console'                  element={<Dashboard />} />
      <Route path='/console/channel'          element={<Channel />} />
      <Route path='/console/token'            element={<Token />} />
      <Route path='/console/log'              element={<Log />} />
      <Route path='/console/user'             element={<User />} />
      <Route path='/console/redemption'       element={<Redemption />} />
      <Route path='/console/subscription'     element={<Subscription />} />
      <Route path='/console/topup'            element={<TopUp />} />
      {/* <Route path='/console/chat'             element={<Chat />} /> */}
      <Route path='/console/setting'          element={<Setting />} />
      <Route path='/console/personal'         element={<Personal />} />

      <Route path='*' element={<Navigate to='/' replace />} />
    </Route>
  </Routes>
);

export default App;
