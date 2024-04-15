import './stylesheets/typography.css'
import './stylesheets/form-elements.css'
import './stylesheets/custom-components.css'
import './stylesheets/alignments.css'
import './stylesheets/theme.css'

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Login from './pages/Login/LoginPage';

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
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
