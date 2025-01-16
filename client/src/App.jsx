import './stylesheets/typography.css'
import './stylesheets/form-elements.css'
import './stylesheets/custom-components.css'
import './stylesheets/alignments.css'
import './stylesheets/theme.css'
import './stylesheets/layout.css'

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useSelector } from "react-redux";

import Loader from "./components/Loader";
import Login from './pages/Login/LoginPage';
import Register from './pages/Register/RegisterPage';
import Home from './pages/Home/HomePage';
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import Transactions from './pages/Transactions/TransactionsPage'
import Requests from './pages/Requests/RequestsPage'
import Users from './pages/Users/UsersPage'
import VerifyTwoFactorAuth from './pages/TwoFactorAuth/Verify2FAPage'
import EnableTwoFactorAuth from './pages/TwoFactorAuth/Enable2FAPage'
import DDoSProtectionPage from './pages/DDOS/DDoSProtectionPage'

function App() {
  const { loading } = useSelector((state) => state.loaders);

  return (
    <>
      {loading && <Loader />}
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/enable-2fa"
            element={
              <ProtectedRoute>
                <EnableTwoFactorAuth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify-2fa"
            element={
              <PublicRoute>
                <VerifyTwoFactorAuth />
              </PublicRoute>
            }
          />
          <Route path="/ddos-protection" element={
            <PublicRoute>
              <DDoSProtectionPage />
            </PublicRoute>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/requests"
            element={
              <ProtectedRoute>
                <Requests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute shouldBeAdmin={true}>
                <Users />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App
