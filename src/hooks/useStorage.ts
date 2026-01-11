import { useState, useEffect } from 'react';
import type { ExtensionConfig, ProgressUpdate } from '../types';

/**
 * Custom hook for accessing Chrome Storage
 */
export function useStorage() {
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
    loadProgress();

    // Listen for storage changes
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local') {
        if (changes['bookmark_classifier_config']) {
          setConfig(changes['bookmark_classifier_config'].newValue);
        }
        if (changes['bookmark_classifier_progress']) {
          setProgress(changes['bookmark_classifier_progress'].newValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    // Listen for progress updates from background script
    const handleMessage = (message: any) => {
      if (message.type === 'PROGRESS_UPDATE') {
        setProgress(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  async function loadConfig() {
    try {
      const result = await chrome.storage.local.get('bookmark_classifier_config');
      setConfig(result['bookmark_classifier_config'] || null);
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProgress() {
    try {
      const result = await chrome.storage.local.get('bookmark_classifier_progress');
      setProgress(result['bookmark_classifier_progress'] || null);
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  }

  async function updateConfig(newConfig: Partial<ExtensionConfig>) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SET_CONFIG',
        payload: newConfig,
      });
      setConfig(response);
      return response;
    } catch (error) {
      console.error('Failed to update config:', error);
      throw error;
    }
  }

  return {
    config,
    progress,
    loading,
    updateConfig,
    reloadConfig: loadConfig,
  };
}

/**
 * Hook for sending messages to background script
 */
export function useMessageHandler() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage<T = any>(type: string, payload?: any): Promise<T> {
    setLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({ type, payload });
      if (response?.error) {
        throw new Error(response.error);
      }
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function startFullMode() {
    return sendMessage('START_FULL_MODE');
  }

  async function stopFullMode() {
    return sendMessage('STOP_FULL_MODE');
  }

  async function getProgress() {
    return sendMessage<ProgressUpdate>('GET_PROGRESS');
  }

  async function exportBookmarks() {
    return sendMessage('EXPORT_BOOKMARKS');
  }

  return {
    loading,
    error,
    sendMessage,
    startFullMode,
    stopFullMode,
    getProgress,
    exportBookmarks,
  };
}
