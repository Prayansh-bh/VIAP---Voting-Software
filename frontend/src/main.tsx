import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { CmsProvider } from './context/CmsContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <NotificationProvider>
        <CmsProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </CmsProvider>
      </NotificationProvider>
    </ErrorBoundary>
  </StrictMode>,
);
