import React, { useState, useEffect } from 'react';
import { useStorage, useMessageHandler } from '../../hooks/useStorage';
import { exportAllBookmarks } from '../../utils/bookmarkExporter';
import './InitPage.css';

type Stage = 'idle' | 'confirm' | 'processing' | 'complete' | 'error';

export const InitPage: React.FC = () => {
  const { config, progress } = useStorage();
  const { startInitialization, loading } = useMessageHandler();
  const [stage, setStage] = useState<Stage>('idle');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config?.isProcessing) {
      setStage('processing');
    } else if (config?.isInitialized) {
      setStage('complete');
    }
  }, [config]);

  useEffect(() => {
    if (progress?.stage === 'complete') {
      setStage('complete');
    } else if (progress?.stage && ['backup', 'sampling', 'categorizing', 'classifying'].includes(progress.stage)) {
      setStage('processing');
    }
  }, [progress]);

  const handleStart = () => {
    setStage('confirm');
  };

  const handleConfirm = async () => {
    setError(null);
    try {
      await startInitialization();
      setStage('processing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start initialization');
      setStage('error');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAllBookmarks();
    } catch (err) {
      console.error('Failed to export bookmarks:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleCancel = () => {
    setStage('idle');
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getStageText = () => {
    if (!progress) return 'Initializing...';
    switch (progress.stage) {
      case 'backup':
        return 'Creating backup archive...';
      case 'sampling':
        return 'Sampling bookmarks...';
      case 'categorizing':
        return 'Creating categories...';
      case 'classifying':
        return `Classifying bookmarks: ${progress.current}/${progress.total}`;
      case 'complete':
        return 'Complete!';
      default:
        return 'Processing...';
    }
  };

  if (stage === 'processing' || stage === 'complete') {
    return (
      <div className="init-page processing">
        <div className="processing-content">
          <div className="status-icon">
            {stage === 'complete' ? '✓' : '⏳'}
          </div>
          <h2>
            {stage === 'complete' ? 'Initialization Complete!' : 'Initializing...'}
          </h2>
          {progress && (
            <>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <p className="progress-text">{getStageText()}</p>
              {progress.message && (
                <p className="progress-message">{progress.message}</p>
              )}
            </>
          )}
          {stage === 'complete' && (
            <button className="btn btn-primary" onClick={() => window.close()}>
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="init-page error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h2>Initialization Failed</h2>
          {error && <p className="error-message">{error}</p>}
          <div className="error-actions">
            <button className="btn btn-primary" onClick={handleConfirm}>
              Retry
            </button>
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'confirm') {
    return (
      <div className="init-page confirm">
        <div className="confirm-content">
          <h2>Confirm Initialization</h2>
          <p className="confirm-warning">
            ⚠️ This will reorganize all your bookmarks into new categories.
          </p>
          <div className="confirm-info">
            <h3>What will happen:</h3>
            <ul>
              <li>All existing bookmarks will be backed up to an "Archive" folder</li>
              <li>Sampled bookmarks will be analyzed to create categories</li>
              <li>All bookmarks will be classified into these categories</li>
              <li>Folders in your excluded list will not be modified</li>
            </ul>
          </div>
          <div className="confirm-export">
            <p>Before proceeding, you may want to export your current bookmarks:</p>
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Export Bookmarks'}
            </button>
          </div>
          <div className="confirm-actions">
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? 'Starting...' : 'Start Initialization'}
            </button>
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="init-page idle">
      <div className="idle-content">
        <h1>Bookmark Classifier</h1>
        <p className="idle-description">
          Organize your bookmarks automatically using AI
        </p>
        <div className="idle-status">
          <div className="status-item">
            <span className="status-label">Status:</span>
            <span className={`status-value ${config?.isInitialized ? 'initialized' : 'not-initialized'}`}>
              {config?.isInitialized ? 'Initialized' : 'Not Initialized'}
            </span>
          </div>
          {config?.isInitialized && (
            <p className="reinit-note">
              Your bookmarks have already been classified. Run initialization again to re-classify all bookmarks.
            </p>
          )}
        </div>
        {!config?.isProcessing && (
          <button className="btn btn-primary btn-large" onClick={handleStart}>
            {config?.isInitialized ? 'Re-initialize' : 'Start Initialization'}
          </button>
        )}
      </div>
    </div>
  );
};
