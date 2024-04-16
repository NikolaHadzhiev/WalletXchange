import './stylesheets/typography.css'
import './stylesheets/form-elements.css'
import './stylesheets/custom-components.css'
import './stylesheets/alignments.css'
import './stylesheets/theme.css'

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Login from './pages/Login/LoginPage';
import Register from './pages/Register/RegisterPage';

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
                <Login />
            }
          />
          <Route
            path="/register"
            element={
                <Register />
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
