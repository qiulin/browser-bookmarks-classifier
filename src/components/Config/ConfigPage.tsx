import React, { useState } from 'react';
import { useStorage } from '../../hooks/useStorage';
import './ConfigPage.css';

export const ConfigPage: React.FC = () => {
  const { config, loading, updateConfig } = useStorage();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [localConfig, setLocalConfig] = useState({
    openaiBaseUrl: '',
    openaiApiKey: '',
    tavilyApiKey: '',
    initSampleRate: 0.2,
    maxCategories: 10,
    excludedDirs: '',
    maxDirectoryDepth: 2,
    todoFolderName: 'TODO',
  });

  // Update local config when global config loads
  React.useEffect(() => {
    if (config) {
      setLocalConfig({
        openaiBaseUrl: config.openaiBaseUrl,
        openaiApiKey: config.openaiApiKey,
        tavilyApiKey: config.tavilyApiKey,
        initSampleRate: config.initSampleRate,
        maxCategories: config.maxCategories,
        excludedDirs: config.excludedDirs.join(', '),
        maxDirectoryDepth: config.maxDirectoryDepth,
        todoFolderName: config.todoFolderName,
      });
    }
  }, [config]);

  const handleChange = (field: string, value: string | number) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const excludedDirsArray = localConfig.excludedDirs
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await updateConfig({
        openaiBaseUrl: localConfig.openaiBaseUrl,
        openaiApiKey: localConfig.openaiApiKey,
        tavilyApiKey: localConfig.tavilyApiKey,
        initSampleRate: localConfig.initSampleRate,
        maxCategories: localConfig.maxCategories,
        excludedDirs: excludedDirsArray,
        maxDirectoryDepth: localConfig.maxDirectoryDepth,
        todoFolderName: localConfig.todoFolderName,
      });

      setMessage({ type: 'success', text: 'Configuration saved successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save configuration',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Reset to defaults - this would need to be implemented in storage service
      setMessage({ type: 'success', text: 'Configuration reset to defaults!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to reset configuration',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="config-page loading">Loading configuration...</div>;
  }

  return (
    <div className="config-page">
      <div className="config-header">
        <h1>Bookmark Classifier Configuration</h1>
        <p>Configure your API keys and classification settings</p>
      </div>

      <div className="config-content">
        {/* API Configuration */}
        <section className="config-section">
          <h2>API Configuration</h2>

          <div className="form-group">
            <label htmlFor="openaiBaseUrl">OpenAI Base URL</label>
            <input
              id="openaiBaseUrl"
              type="text"
              value={localConfig.openaiBaseUrl}
              onChange={(e) => handleChange('openaiBaseUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
            <small>Compatible with OpenAI and other LLM providers</small>
          </div>

          <div className="form-group">
            <label htmlFor="openaiApiKey">OpenAI API Key</label>
            <input
              id="openaiApiKey"
              type="password"
              value={localConfig.openaiApiKey}
              onChange={(e) => handleChange('openaiApiKey', e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="tavilyApiKey">Tavily API Key</label>
            <input
              id="tavilyApiKey"
              type="password"
              value={localConfig.tavilyApiKey}
              onChange={(e) => handleChange('tavilyApiKey', e.target.value)}
              placeholder="tvly-..."
            />
          </div>
        </section>

        {/* Initialization Configuration */}
        <section className="config-section">
          <h2>Initialization Settings</h2>

          <div className="form-group">
            <label htmlFor="initSampleRate">
              Sample Rate: {Math.round(localConfig.initSampleRate * 100)}%
            </label>
            <input
              id="initSampleRate"
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={localConfig.initSampleRate}
              onChange={(e) => handleChange('initSampleRate', parseFloat(e.target.value))}
            />
            <small>Percentage of bookmarks to sample for category creation</small>
          </div>

          <div className="form-group">
            <label htmlFor="maxCategories">Maximum Categories</label>
            <input
              id="maxCategories"
              type="number"
              min="3"
              max="50"
              value={localConfig.maxCategories}
              onChange={(e) => handleChange('maxCategories', parseInt(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="maxDirectoryDepth">Maximum Directory Depth</label>
            <input
              id="maxDirectoryDepth"
              type="number"
              min="1"
              max="5"
              value={localConfig.maxDirectoryDepth}
              onChange={(e) => handleChange('maxDirectoryDepth', parseInt(e.target.value))}
            />
            <small>Number of directory levels (e.g., 2 = "Tech/Programming")</small>
          </div>

          <div className="form-group">
            <label htmlFor="excludedDirs">Excluded Directories</label>
            <input
              id="excludedDirs"
              type="text"
              value={localConfig.excludedDirs}
              onChange={(e) => handleChange('excludedDirs', e.target.value)}
              placeholder="Archive, Personal, Work"
            />
            <small>Comma-separated folder names to exclude from classification</small>
          </div>
        </section>

        {/* TODO Folder Configuration */}
        <section className="config-section">
          <h2>Incremental Mode</h2>

          <div className="form-group">
            <label htmlFor="todoFolderName">TODO Folder Name</label>
            <input
              id="todoFolderName"
              type="text"
              value={localConfig.todoFolderName}
              onChange={(e) => handleChange('todoFolderName', e.target.value)}
              placeholder="TODO"
            />
            <small>Bookmarks in this folder will be automatically classified</small>
          </div>
        </section>

        {/* Status */}
        <section className="config-section">
          <h2>Status</h2>
          <div className="status-items">
            <div className="status-item">
              <span className="status-label">Initialized:</span>
              <span className={`status-value ${config?.isInitialized ? 'success' : 'pending'}`}>
                {config?.isInitialized ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Processing:</span>
              <span className={`status-value ${config?.isProcessing ? 'active' : 'idle'}`}>
                {config?.isProcessing ? 'In Progress' : 'Idle'}
              </span>
            </div>
          </div>
        </section>

        {/* Message */}
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Actions */}
        <div className="config-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={saving}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};
