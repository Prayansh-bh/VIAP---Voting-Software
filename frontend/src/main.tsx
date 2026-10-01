import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
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
          <App />
        </CmsProvider>
      </NotificationProvider>
    </ErrorBoundary>
  </StrictMode>,
);
