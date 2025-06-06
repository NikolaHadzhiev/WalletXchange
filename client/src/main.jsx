import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import "antd/dist/reset.css"
import { Provider } from 'react-redux';
import store from "./state/store";
import { BrowserRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Provider store={store}>
      <App />
    </Provider>
  </BrowserRouter>
);
