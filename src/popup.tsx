import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupInitPage } from './components/Initialization/PopupInitPage';
import { useStorage } from './hooks/useStorage';
import './popup.css';

const PopupApp: React.FC = () => {
  const { config, loading } = useStorage();

  if (loading) {
    return <div className="popup-container loading">Loading...</div>;
  }

  return (
    <div className="popup-container">
      <nav className="popup-nav">
        <button
          className={`nav-button ${!config?.isInitialized ? 'active' : ''}`}
          onClick={() => {
            // Simple navigation - just show different content
            const root = document.getElementById('popup-root');
            if (root) {
              root.setAttribute('data-view', 'init');
            }
          }}
        >
          {config?.isInitialized ? 'Status' : 'Initialize'}
        </button>
        <button
          className="nav-button"
          onClick={() => {
            chrome.tabs.create({ url: 'options.html' });
            window.close();
          }}
        >
          Settings
        </button>
      </nav>

      <main className="popup-main">
        <PopupInitPage />
      </main>
    </div>
  );
};

// Safely create root - prevent duplicate createRoot calls
const rootElement = document.getElementById('popup-root');
if (rootElement && !(rootElement as any)._reactRoot) {
  const root = ReactDOM.createRoot(rootElement);
  (rootElement as any)._reactRoot = root;
  root.render(
    <React.StrictMode>
      <PopupApp />
    </React.StrictMode>
  );
}
