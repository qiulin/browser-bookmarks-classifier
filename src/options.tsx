import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigPage } from './components/Config/ConfigPage';
import { InitPage } from './components/Initialization/InitPage';
import { useStorage } from './hooks/useStorage';
import './options.css';

const OptionsApp: React.FC = () => {
  const { loading } = useStorage();
  const [activeTab, setActiveTab] = React.useState<'config' | 'init'>('config');

  if (loading) {
    return <div className="options-container loading">Loading...</div>;
  }

  return (
    <div className="options-container">
      <header className="options-header">
        <h1>Bookmark Classifier</h1>
        <p>Organize your bookmarks automatically using AI</p>
      </header>

      <nav className="options-nav">
        <button
          className={`nav-button ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          Configuration
        </button>
        <button
          className={`nav-button ${activeTab === 'init' ? 'active' : ''}`}
          onClick={() => setActiveTab('init')}
        >
          Initialization
        </button>
      </nav>

      <main className="options-main">
        {activeTab === 'config' && <ConfigPage />}
        {activeTab === 'init' && <InitPage />}
      </main>

      <footer className="options-footer">
        <p>Bookmark Classifier v1.0.0</p>
      </footer>
    </div>
  );
};

// Safely create root - prevent duplicate createRoot calls
const rootElement = document.getElementById('options-root');
if (rootElement && !(rootElement as any)._reactRoot) {
  const root = ReactDOM.createRoot(rootElement);
  (rootElement as any)._reactRoot = root;
  root.render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>
  );
}
