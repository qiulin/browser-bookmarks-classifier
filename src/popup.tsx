import React from 'react';
import ReactDOM from 'react-dom/client';
import { useStorage } from './hooks/useStorage';
import './popup.css';

const PopupApp: React.FC = () => {
  const { config, loading } = useStorage();

  const handleOpenInitialization = () => {
    chrome.tabs.create({ url: 'options.html?tab=init' });
    window.close();
  };

  const handleOpenSettings = () => {
    chrome.tabs.create({ url: 'options.html?tab=config' });
    window.close();
  };

  if (loading) {
    return <div className="popup-container loading">Loading...</div>;
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>Bookmark Classifier</h1>
        <p className="popup-subtitle">Organize bookmarks automatically with AI</p>
      </div>

      <div className="popup-content">
        <div className="menu-item" onClick={handleOpenInitialization}>
          <div className="menu-icon">🚀</div>
          <div className="menu-info">
            <div className="menu-title">Initialization</div>
            <div className="menu-desc">
              {config?.isInitialized ? 'Re-classify all bookmarks' : 'Start initial classification'}
            </div>
          </div>
          <div className="menu-arrow">→</div>
        </div>

        <div className="menu-item" onClick={handleOpenSettings}>
          <div className="menu-icon">⚙️</div>
          <div className="menu-info">
            <div className="menu-title">Configuration</div>
            <div className="menu-desc">API keys and settings</div>
          </div>
          <div className="menu-arrow">→</div>
        </div>

        <div className="popup-status">
          <div className="status-row">
            <span className="status-label">Status:</span>
            <span className={`status-badge ${config?.isInitialized ? 'success' : 'pending'}`}>
              {config?.isInitialized ? 'Initialized' : 'Not Initialized'}
            </span>
          </div>
          {config?.isProcessing && (
            <div className="status-row">
              <span className="status-label">Processing:</span>
              <span className="status-badge active">In Progress</span>
            </div>
          )}
        </div>
      </div>
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
