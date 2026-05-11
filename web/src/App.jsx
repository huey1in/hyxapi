/*
 * App — 路由 + 主壳
 *
 * 16 个业务页面：
 *   公共：     /  /pricing  /forbidden  /privacy-policy  /user-agreement
 *   私有：    /console (Dashboard)  /console/playground  /console/token  /console/log
 *             /console/topup  /console/personal*（待补）
 *   管理员：  /console/subscription  /console/channel  /console/redemption
 *             /console/user  /console/setting
 *   独立壳：  /setup
 *
 * SetupCheck / OAuth / PasswordReset / AuthLegacy 等会在 Phase 2 接入。
 */

import React from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PrivateRoute, AdminRoute } from './helpers';

import PageLayout from './layout/PageLayout';
import OAuth2Callback from './components/business/auth/OAuth2Callback';

import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Pricing from './pages/Pricing';
import Playground from './pages/Playground';
import TopUp from './pages/TopUp';
import Subscription from './pages/Subscription';
import Token from './pages/Token';
import Redemption from './pages/Redemption';
import Log from './pages/Log';
import Channel from './pages/Channel';
import User from './pages/User';
import Setting from './pages/Setting';
import Setup from './pages/Setup';
import Forbidden from './pages/Forbidden';
import PrivacyPolicy from './pages/PrivacyPolicy';
import UserAgreement from './pages/UserAgreement';
import Personal from './pages/Personal';

const NotFoundRedirect = () => {
  let loggedIn = false;
  try { loggedIn = !!localStorage.getItem('user'); } catch {}
  return <Navigate to={loggedIn ? '/console' : '/'} replace />;
};

const DynamicOAuth = () => {
  const { provider } = useParams();
  return <OAuth2Callback type={provider} />;
};

const App = () => (
  <Routes>
    <Route path='/setup' element={<Setup />} />

    {/* OAuth 回调（不挂主壳，独立处理） */}
    <Route path='/oauth/github'   element={<OAuth2Callback type='github' />} />
    <Route path='/oauth/discord'  element={<OAuth2Callback type='discord' />} />
    <Route path='/oauth/oidc'     element={<OAuth2Callback type='oidc' />} />
    <Route path='/oauth/linuxdo'  element={<OAuth2Callback type='linuxdo' />} />
    <Route path='/oauth/:provider' element={<DynamicOAuth />} />

    <Route element={<PageLayout />}>
      <Route path='/' element={<Home />} />
      <Route path='/pricing' element={<Pricing />} />
      <Route path='/forbidden' element={<Forbidden />} />
      <Route path='/privacy-policy' element={<PrivacyPolicy />} />
      <Route path='/user-agreement' element={<UserAgreement />} />

      <Route path='/console'             element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path='/console/playground'  element={<PrivateRoute><Playground /></PrivateRoute>} />
      <Route path='/console/token'       element={<PrivateRoute><Token /></PrivateRoute>} />
      <Route path='/console/log'         element={<PrivateRoute><Log /></PrivateRoute>} />
      <Route path='/console/topup'       element={<PrivateRoute><TopUp /></PrivateRoute>} />
      <Route path='/console/personal'    element={<PrivateRoute><Personal /></PrivateRoute>} />

      <Route path='/console/subscription' element={<AdminRoute><Subscription /></AdminRoute>} />
      <Route path='/console/channel'      element={<AdminRoute><Channel /></AdminRoute>} />
      <Route path='/console/redemption'   element={<AdminRoute><Redemption /></AdminRoute>} />
      <Route path='/console/user'         element={<AdminRoute><User /></AdminRoute>} />
      <Route path='/console/setting'      element={<AdminRoute><Setting /></AdminRoute>} />

      <Route path='*' element={<NotFoundRedirect />} />
    </Route>
  </Routes>
);

export default App;
