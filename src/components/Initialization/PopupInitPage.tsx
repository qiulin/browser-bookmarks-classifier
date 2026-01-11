import React from 'react';
import { useStorage } from '../../hooks/useStorage';
import './PopupInitPage.css';

export const PopupInitPage: React.FC = () => {
  const { config, progress } = useStorage();

  const getProgressPercentage = () => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getStageText = () => {
    if (!progress) return '';

    switch (progress.stage) {
      case 'backup':
        return 'Creating backup...';
      case 'sampling':
        return 'Sampling bookmarks...';
      case 'categorizing':
        return 'Creating categories...';
      case 'classifying':
        return 'Classifying...';
      case 'complete':
        return 'Complete!';
      default:
        return '';
    }
  };

  const openFullInitPage = () => {
    chrome.tabs.create({ url: 'options.html?tab=init' });
    window.close();
  };

  // Processing state
  if (config?.isProcessing) {
    const progressPercent = getProgressPercentage();

    return (
      <div className="popup-init-page processing">
        <div className="processing-header">
          <div className="status-icon">⟳</div>
          <h3>Initializing...</h3>
        </div>

        <div className="progress-summary">
          <div className="progress-percentage">{progressPercent}%</div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress && progress.total > 0 && (
            <div className="progress-count">
              {progress.current} / {progress.total}
            </div>
          )}
          {getStageText() && (
            <div className="progress-stage">{getStageText()}</div>
          )}
        </div>

        <button className="btn btn-secondary btn-block" onClick={openFullInitPage}>
          View Details
        </button>
      </div>
    );
  }

  // Completed state
  if (config?.isInitialized) {
    return (
      <div className="popup-init-page initialized">
        <div className="success-icon">✓</div>
        <h3>Initialized</h3>
        <p>Your bookmarks have been organized.</p>

        <button className="btn btn-primary btn-block" onClick={openFullInitPage}>
          Re-initialize
        </button>
      </div>
    );
  }

  // Not initialized state
  return (
    <div className="popup-init-page idle">
      <div className="idle-icon">📁</div>
      <h3>Not Initialized</h3>
      <p>Organize your bookmarks automatically using AI.</p>

      <button className="btn btn-primary btn-block" onClick={openFullInitPage}>
        Start Initialization
      </button>
    </div>
  );
};
