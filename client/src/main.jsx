import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { drainOutbox } from './offline/sync.js';
import { browserOnline } from './offline/networkState.js';
import { initTheme } from './utils/theme.js';
import './styles/index.css';
import './styles/theme-overrides.css';

initTheme();

registerSW({ immediate: true });

if (typeof window !== 'undefined' && localStorage.getItem('spendly_token') && browserOnline()) {
  drainOutbox().catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
