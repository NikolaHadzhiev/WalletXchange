import './stylesheets/typography.css'
import './stylesheets/form-elements.css'
import './stylesheets/custom-components.css'
import './stylesheets/alignments.css'
import './stylesheets/theme.css'
import './stylesheets/layout.css'

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Login from './pages/Login/LoginPage';
import Register from './pages/Register/RegisterPage';
import Home from './pages/Home/HomePage';
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import Transactions from './pages/Transactions/TransactionsPage'

function App() {
  return (
    <>
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
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
