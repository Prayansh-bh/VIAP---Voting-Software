import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { CmsProvider } from './context/CmsContext';
import { NotificationProvider } from './context/NotificationContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <CmsProvider>
          <App />
        </CmsProvider>
      </NotificationProvider>
    </BrowserRouter>
  </React.StrictMode>
);
