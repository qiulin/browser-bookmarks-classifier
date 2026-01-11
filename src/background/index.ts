import { storageService } from '../services/storage';
import { classifierService } from '../services/classifier';
import { bookmarkService } from '../services/bookmarkService';
import type { Message, ProgressUpdate } from '../types';

/**
 * Background Service Worker
 * Handles initialization mode and incremental mode
 */

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Bookmark Classifier: Service worker started');
  initializeServices();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Bookmark Classifier: Extension installed');
  initializeServices();
});

/**
 * Initialize services with stored configuration
 */
async function initializeServices() {
  try {
    const config = await storageService.getConfig();

    // Restore processing state
    if (config.isProcessing && !classifierService.isActive()) {
      // Reset processing state if service was interrupted
      await storageService.setConfig({ isProcessing: false });
      await storageService.clearProgress();
    }

    console.log('Bookmark Classifier: Services initialized');
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
}

/**
 * Handle messages from popup and options pages
 */
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(error => {
    sendResponse({ error: error.message });
  });
  return true; // Keep message channel open for async response
});

/**
 * Handle incoming messages
 */
async function handleMessage(message: Message): Promise<any> {
  switch (message.type) {
    case 'GET_CONFIG':
      return storageService.getConfig();

    case 'SET_CONFIG':
      return storageService.setConfig(message.payload);

    case 'START_INITIALIZATION':
      return startInitialization();

    case 'GET_PROGRESS':
      return storageService.getProgress();

    case 'CLASSIFY_BOOKMARK':
      return classifyBookmark(message.payload.bookmarkId);

    case 'EXPORT_BOOKMARKS':
      return exportBookmarks();

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

/**
 * Start initialization mode
 */
async function startInitialization(): Promise<void> {
  const config = await storageService.getConfig();

  if (!config.openaiApiKey || !config.tavilyApiKey) {
    throw new Error('API keys are not configured');
  }

  if (config.isProcessing) {
    throw new Error('Classification is already in progress');
  }

  await storageService.setConfig({ isProcessing: true });

  // Run initialization with progress callback
  classifierService.runInitialization(async (progress: ProgressUpdate) => {
    await storageService.setProgress(progress);

    // Notify all listeners (popup, options pages)
    chrome.runtime.sendMessage({
      type: 'PROGRESS_UPDATE',
      payload: progress,
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }).catch(error => {
    console.error('Initialization failed:', error);
    throw error;
  });
}

/**
 * Classify a single bookmark (for incremental mode)
 */
async function classifyBookmark(bookmarkId: string): Promise<void> {
  try {
    const bookmark = await bookmarkService.getBookmark(bookmarkId);

    if (!bookmark.url) {
      throw new Error('Bookmark has no URL');
    }

    const result = await classifierService.classifySingleBookmark(bookmark);
    console.log(`Classified "${bookmark.title}" to "${result.path}"`);
  } catch (error) {
    console.error(`Failed to classify bookmark ${bookmarkId}:`, error);
    throw error;
  }
}

/**
 * Export all bookmarks
 */
async function exportBookmarks(): Promise<void> {
  const tree = await bookmarkService.getTree();
  // This will be handled by the caller (popup/options page)
  // Just return the tree
  return tree as any;
}

/**
 * Listen for bookmark creation (incremental mode)
 */
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  try {
    const config = await storageService.getConfig();

    // Only proceed if initialization is complete
    if (!config.isInitialized) {
      return;
    }

    // Check if bookmark is in TODO folder
    if (bookmark.parentId) {
      const parent = await bookmarkService.getBookmark(bookmark.parentId);
      const isTodoFolder = parent.title === config.todoFolderName;

      if (isTodoFolder && bookmark.url) {
        console.log(`New bookmark in TODO folder: ${bookmark.title}`);
        await classifyBookmark(id);
      }
    }
  } catch (error) {
    console.error('Error in bookmark onCreated listener:', error);
  }
});

/**
 * Listen for bookmark changes (optional: re-classify on edit)
 */
chrome.bookmarks.onChanged.addListener(async (_id, _changeInfo) => {
  // Optional: Re-classify bookmark when title is changed
  // For now, we'll skip this to avoid unnecessary API calls
});

// Keep service worker alive (Chrome may suspend it)
// This is a simple heartbeat to prevent the worker from being suspended too quickly
let heartbeat: number | undefined;

function startHeartbeat() {
  heartbeat = self.setInterval(() => {
    chrome.storage.local.get('heartbeat', () => {
      // Just a no-op to keep the worker alive
    });
  }, 20000); // Every 20 seconds
}

function stopHeartbeat() {
  if (heartbeat !== undefined) {
    clearInterval(heartbeat);
  }
}

// Start heartbeat
startHeartbeat();

// Cleanup on shutdown
chrome.runtime.onSuspend.addListener(() => {
  console.log('Bookmark Classifier: Service worker suspending');
  stopHeartbeat();
});

// Export for testing
export { initializeServices, handleMessage };
