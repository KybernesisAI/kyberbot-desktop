import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initLogSubscription } from './hooks/useLogs';
import './styles/globals.css';

// Load saved theme preference before first render (light is default)
const savedTheme = localStorage.getItem('kyberbot_theme');
if (savedTheme !== 'dark') {
  document.documentElement.classList.add('light');
}

// Start capturing logs immediately (before React renders)
initLogSubscription();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
