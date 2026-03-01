import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ServerConfigProvider } from './serverConfig';
import { SettingsProvider } from './settings';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ServerConfigProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </ServerConfigProvider>
  </React.StrictMode>
);
