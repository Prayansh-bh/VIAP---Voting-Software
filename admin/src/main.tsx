import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CmsProvider } from './context/CmsContext';
import { NotificationProvider } from './context/NotificationContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <CmsProvider>
        <App />
      </CmsProvider>
    </NotificationProvider>
  </React.StrictMode>
);
