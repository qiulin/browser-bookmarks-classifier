import React from 'react';
import ReactDOM from 'react-dom/client';
import { InitPage } from './components/Initialization/InitPage';
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
        <InitPage />
      </main>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('popup-root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
