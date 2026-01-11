import { ExtensionConfig, DEFAULT_CONFIG } from '../types';
import { STORAGE_KEY_CONFIG, STORAGE_KEY_PROGRESS } from '../utils/constants';
import type { ProgressUpdate } from '../types';

/**
 * Storage Service - Wrapper for Chrome Storage API
 */
class StorageService {
  /**
   * Get the extension configuration
   */
  async getConfig(): Promise<ExtensionConfig> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY_CONFIG, (result) => {
        const stored = result[STORAGE_KEY_CONFIG];
        if (stored) {
          resolve({ ...DEFAULT_CONFIG, ...stored });
        } else {
          resolve(DEFAULT_CONFIG);
        }
      });
    });
  }

  /**
   * Set the extension configuration
   */
  async setConfig(config: Partial<ExtensionConfig>): Promise<ExtensionConfig> {
    return new Promise((resolve) => {
      this.getConfig().then(currentConfig => {
        const newConfig = { ...currentConfig, ...config };
        chrome.storage.local.set(
          { [STORAGE_KEY_CONFIG]: newConfig },
          () => resolve(newConfig)
        );
      });
    });
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<ExtensionConfig> {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        { [STORAGE_KEY_CONFIG]: DEFAULT_CONFIG },
        () => resolve(DEFAULT_CONFIG)
      );
    });
  }

  /**
   * Check if API keys are configured
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return !!(config.openaiApiKey && config.tavilyApiKey);
  }

  /**
   * Get current progress
   */
  async getProgress(): Promise<ProgressUpdate | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY_PROGRESS, (result) => {
        resolve(result[STORAGE_KEY_PROGRESS] || null);
      });
    });
  }

  /**
   * Set progress
   */
  async setProgress(progress: ProgressUpdate): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        { [STORAGE_KEY_PROGRESS]: progress },
        () => resolve()
      );
    });
  }

  /**
   * Clear progress
   */
  async clearProgress(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(STORAGE_KEY_PROGRESS, () => resolve());
    });
  }

  /**
   * Get a value by key
   */
  async get<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key]);
      });
    });
  }

  /**
   * Set a value by key
   */
  async set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }

  /**
   * Remove a value by key
   */
  async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, () => resolve());
    });
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => resolve());
    });
  }

  /**
   * Listen to storage changes
   */
  onChanged(callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  }
}

// Export singleton instance
export const storageService = new StorageService();
