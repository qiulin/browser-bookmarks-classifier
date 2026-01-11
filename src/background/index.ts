import { storageService } from '../services/storage';
import { classifierService } from '../services/classifier';
import { bookmarkService } from '../services/bookmarkService';
import type { Message, ProgressUpdate } from '../types';

/**
 * Background Service Worker
 * Handles initialization mode and incremental mode
 */

// Track processed bookmark IDs to avoid re-processing
const processedBookmarkIds = new Set<string>();
let todoCheckTimer: number | undefined;

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

    // Start TODO folder checking
    startTodoCheck(config);

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
      const newConfig = await storageService.setConfig(message.payload);
      // Restart TODO check with new configuration
      stopTodoCheck();
      startTodoCheck(newConfig);
      return newConfig;

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

    // Start TODO checking after initialization completes
    if (progress.stage === 'complete') {
      const updatedConfig = await storageService.getConfig();
      startTodoCheck(updatedConfig);
    }
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
 * Start checking TODO folder at configured interval
 */
function startTodoCheck(config: any) {
  // Clear existing timer if any
  stopTodoCheck();

  // Only start if initialization is complete
  if (!config.isInitialized) {
    return;
  }

  // Check immediately on start
  checkTodoFolder(config);

  // Set up periodic checks
  todoCheckTimer = self.setInterval(() => {
    checkTodoFolder(config);
  }, config.checkInterval);
}

/**
 * Stop checking TODO folder
 */
function stopTodoCheck() {
  if (todoCheckTimer !== undefined) {
    self.clearInterval(todoCheckTimer);
    todoCheckTimer = undefined;
  }
}

/**
 * Check TODO folder for new bookmarks and classify them
 */
async function checkTodoFolder(config: any) {
  try {
    // Only proceed if initialization is complete and not processing
    if (!config.isInitialized || config.isProcessing) {
      return;
    }

    // Get TODO folder
    const tree = await bookmarkService.getTree();
    let todoFolderId: string | null = null;

    // Search for TODO folder
    function findTodoFolder(nodes: chrome.bookmarks.BookmarkTreeNode[]): void {
      for (const node of nodes) {
        if (node.title === config.todoFolderName && !node.url) {
          todoFolderId = node.id;
          return;
        }
        if (node.children) {
          findTodoFolder(node.children);
        }
      }
    }

    for (const root of tree) {
      if (root.children) {
        findTodoFolder(root.children);
        if (todoFolderId) break;
      }
    }

    if (!todoFolderId) {
      return; // TODO folder not found
    }

    // Get bookmarks in TODO folder
    const bookmarks = await bookmarkService.getBookmarksInFolder(todoFolderId);

    // Process new bookmarks
    for (const bookmark of bookmarks) {
      if (bookmark.url && !processedBookmarkIds.has(bookmark.id)) {
        console.log(`Found new bookmark in TODO folder: ${bookmark.title}`);
        try {
          await classifyBookmark(bookmark.id);
          processedBookmarkIds.add(bookmark.id);
        } catch (error) {
          console.error(`Failed to classify bookmark ${bookmark.title}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error checking TODO folder:', error);
  }
}

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
  stopTodoCheck();
});

// Export for testing
export { initializeServices, handleMessage };
