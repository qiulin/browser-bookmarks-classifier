import { tavilyService } from './tavilyService';
import { openaiService } from './openaiService';
import { bookmarkService } from './bookmarkService';
import { storageService } from './storage';
import { BATCH_SIZE, BACKUP_FOLDER_NAME, FAILURES_FOLDER_NAME } from '../utils/constants';
import { sampleArray, batchArray, sleep } from '../utils/helpers';
import type { ProgressUpdate, ExtensionConfig } from '../types';

/**
 * Classification progress callback
 */
export type ProgressCallback = (progress: ProgressUpdate) => void;

/**
 * Classifier Service - Core classification logic
 */
class ClassifierService {
  private abortController: AbortController | null = null;
  private isProcessing: boolean = false;

  /**
   * Run the initialization mode
   * @param progressCallback - Callback for progress updates
   */
  async runInitialization(progressCallback?: ProgressCallback): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Classification is already in progress');
    }

    this.isProcessing = true;
    this.abortController = new AbortController();

    try {
      const config = await storageService.getConfig();

      // Update services with current API keys and model
      tavilyService.setApiKey(config.tavilyApiKey);
      openaiService.setBaseUrl(config.openaiBaseUrl);
      openaiService.setApiKey(config.openaiApiKey);
      openaiService.setModel(config.llmModel);

      await this._runInitialization(config, progressCallback);
    } finally {
      this.isProcessing = false;
      this.abortController = null;
      await storageService.setConfig({ isProcessing: false });
    }
  }

  /**
   * Internal initialization logic
   */
  private async _runInitialization(
    config: ExtensionConfig,
    progressCallback?: ProgressCallback
  ): Promise<void> {
    const signal = this.abortController!.signal;

    // Stage 1: Backup
    if (signal.aborted) throw new Error('Aborted');
    progressCallback?.({
      current: 0,
      total: 100,
      message: 'Creating backup archive...',
      stage: 'backup',
    });

    await bookmarkService.createArchive();

    // Stage 2: Get all bookmarks
    if (signal.aborted) throw new Error('Aborted');
    const allBookmarks = await bookmarkService.getAllBookmarks(config.excludedDirs);

    if (allBookmarks.length === 0) {
      throw new Error('No bookmarks found to classify');
    }

    const total = allBookmarks.length;

    // Stage 3: Sample bookmarks
    if (signal.aborted) throw new Error('Aborted');
    progressCallback?.({
      current: 1,
      total,
      message: 'Sampling bookmarks for category creation...',
      stage: 'sampling',
    });

    const sampledBookmarks = sampleArray(allBookmarks, config.initSampleRate);

    // Stage 4: Fetch content for samples
    if (signal.aborted) throw new Error('Aborted');
    progressCallback?.({
      current: sampledBookmarks.length,
      total,
      message: 'Fetching sample bookmark content...',
      stage: 'sampling',
    });

    const sampleData = await this._fetchBatchContent(
      sampledBookmarks.filter(b => b.url),
      signal
    );

    // Stage 5: Create categories
    if (signal.aborted) throw new Error('Aborted');
    progressCallback?.({
      current: sampledBookmarks.length,
      total,
      message: 'Creating categories...',
      stage: 'categorizing',
    });

    const validSampleData = sampleData.filter(d => d !== null) as Array<{
      title: string;
      url: string;
      content: string;
    }>;

    if (validSampleData.length === 0) {
      throw new Error('Failed to fetch content for sample bookmarks');
    }

    const categories = await openaiService.createCategories(
      validSampleData,
      config.maxCategories,
      config.maxDirectoryDepth,
      config.defaultLanguage
    );

    // Create category folders
    const rootFolderId = await bookmarkService.getDefaultFolderId();
    const categoryIds: Record<string, string> = {};

    for (const category of categories) {
      const folderId = await bookmarkService.createFolderPath(category, rootFolderId);
      categoryIds[category] = folderId;
    }

    // Stage 6: Classify all bookmarks
    if (signal.aborted) throw new Error('Aborted');
    progressCallback?.({
      current: 0,
      total,
      message: 'Classifying bookmarks...',
      stage: 'classifying',
    });

    // Create Failures folder
    const failuresFolderId = await bookmarkService.createFolderPath(
      FAILURES_FOLDER_NAME,
      rootFolderId
    );

    let classified = 0;
    let failed = 0;
    const existingCategories = Object.keys(categoryIds);

    for (const bookmark of allBookmarks) {
      if (signal.aborted) throw new Error('Aborted');

      if (!bookmark.url) {
        classified++;
        continue;
      }

      try {
        const result = await this._classifySingleBookmark(
          bookmark,
          existingCategories,
          config.maxDirectoryDepth,
          rootFolderId,
          signal,
          config.defaultLanguage
        );

        // Move to classified folder
        await bookmarkService.moveBookmark(bookmark.id!, result.folderId);

        classified++;
        progressCallback?.({
          current: classified,
          total,
          message: `Classified: ${bookmark.title}`,
          stage: 'classifying',
        });
      } catch (error) {
        console.error(`Failed to classify bookmark ${bookmark.title}:`, error);
        // Move to Failures folder
        try {
          await bookmarkService.moveBookmark(bookmark.id!, failuresFolderId);
          failed++;
        } catch (moveError) {
          console.error(`Failed to move bookmark to Failures folder:`, moveError);
        }
        classified++;
      }
    }

    // Complete
    const successMessage = failed > 0
      ? `Classification complete! ${failed} bookmarks moved to Failures folder.`
      : 'Classification complete!';
    progressCallback?.({
      current: total,
      total,
      message: successMessage,
      stage: 'complete',
    });

    // Clean up empty folders
    progressCallback?.({
      current: total,
      total,
      message: 'Cleaning up empty folders...',
      stage: 'complete',
    });
    // Extract top-level category folder names
    const topLevelCategories = categories.map(cat => {
      const parts = cat.split('/');
      return parts[0];
    });
    await this._cleanupEmptyFolders(rootFolderId, [BACKUP_FOLDER_NAME, FAILURES_FOLDER_NAME, ...topLevelCategories]);

    // Mark as initialized
    await storageService.setConfig({ isInitialized: true });
  }

  /**
   * Classify a single bookmark (for incremental mode)
   * @param bookmark - Bookmark to classify
   * @returns Classification result with folder ID
   */
  async classifySingleBookmark(
    bookmark: chrome.bookmarks.BookmarkTreeNode
  ): Promise<{ path: string; folderId: string }> {
    const config = await storageService.getConfig();

    // Update services with current API keys and model
    tavilyService.setApiKey(config.tavilyApiKey);
    openaiService.setBaseUrl(config.openaiBaseUrl);
    openaiService.setApiKey(config.openaiApiKey);
    openaiService.setModel(config.llmModel);

    if (!bookmark.url) {
      throw new Error('Bookmark has no URL');
    }

    // Get existing categories
    const tree = await bookmarkService.getTree();
    const categories = this._extractExistingCategories(tree);

    const rootFolderId = await bookmarkService.getDefaultFolderId();

    return this._classifySingleBookmark(
      bookmark,
      categories,
      config.maxDirectoryDepth,
      rootFolderId,
      undefined,
      config.defaultLanguage
    );
  }

  /**
   * Internal method to classify a single bookmark
   */
  private async _classifySingleBookmark(
    bookmark: chrome.bookmarks.BookmarkTreeNode,
    existingCategories: string[],
    maxDepth: number,
    rootFolderId: string,
    signal?: AbortSignal,
    language: string = 'en'
  ): Promise<{ path: string; folderId: string }> {
    // Fetch page content
    const content = await tavilyService.fetchPageContent(bookmark.url!);

    if (signal?.aborted) throw new Error('Aborted');

    // Classify using OpenAI
    const result = await openaiService.classifyBookmark(
      bookmark.title,
      bookmark.url!,
      content.content,
      existingCategories,
      maxDepth,
      language
    );

    // Get or create target folder
    const folderId = await bookmarkService.getOrCreateFolder(result.path, rootFolderId);

    return {
      path: result.path,
      folderId,
    };
  }

  /**
   * Fetch content for multiple bookmarks in batches
   */
  private async _fetchBatchContent(
    bookmarks: chrome.bookmarks.BookmarkTreeNode[],
    signal?: AbortSignal
  ): Promise<Array<{ title: string; url: string; content: string } | null>> {
    const results: Array<{ title: string; url: string; content: string } | null> = [];
    const batches = batchArray(bookmarks, BATCH_SIZE);

    for (const batch of batches) {
      if (signal?.aborted) throw new Error('Aborted');

      const batchResults = await Promise.allSettled(
        batch.map(async (bookmark) => {
          if (!bookmark.url) return null;

          try {
            const content = await tavilyService.fetchPageContent(bookmark.url);
            return {
              title: bookmark.title,
              url: bookmark.url,
              content: content.content,
            };
          } catch (error) {
            console.error(`Failed to fetch content for ${bookmark.url}:`, error);
            return null;
          }
        })
      );

      for (const result of batchResults) {
        results.push(result.status === 'fulfilled' ? result.value : null);
      }

      // Add delay between batches
      await sleep(500);
    }

    return results;
  }

  /**
   * Extract existing category paths from bookmark tree
   */
  private _extractExistingCategories(
    tree: chrome.bookmarks.BookmarkTreeNode[]
  ): string[] {
    const categories: string[] = [];

    function traverse(node: chrome.bookmarks.BookmarkTreeNode, path: string[] = []) {
      const currentPath = [...path, node.title];

      // Only add folders that are direct children of root or at depth 2
      if (node.children && node.children.length > 0) {
        // Check if this folder has bookmarks (is a category)
        const hasBookmarks = node.children.some(child => child.url);
        if (hasBookmarks) {
          categories.push(currentPath.join('/'));
        }

        // Recursively process children
        for (const child of node.children) {
          traverse(child, currentPath);
        }
      }
    }

    for (const root of tree) {
      if (root.children) {
        for (const child of root.children) {
          traverse(child, []);
        }
      }
    }

    return categories;
  }

  /**
   * Clean up empty folders after classification
   * @param rootFolderId - Root folder ID to start cleanup from
   * @param excludeFolders - Folder names to exclude from cleanup
   */
  private async _cleanupEmptyFolders(
    rootFolderId: string,
    excludeFolders: string[]
  ): Promise<void> {
    const tree = await bookmarkService.getTree();
    const emptyFolderIds: string[] = [];

    // Find all empty folders
    function findEmptyFolders(node: chrome.bookmarks.BookmarkTreeNode, parentPath: string[] = []) {
      const currentPath = [...parentPath, node.title];

      if (!node.url && node.children) {
        // Check if this is an excluded folder
        if (excludeFolders.includes(node.title)) {
          return;
        }

        // Check if folder is empty (no children or all children are empty folders)
        const hasContent = node.children.some(child => {
          if (child.url) return true; // Has bookmark
          if (child.children && child.children.length > 0) {
            // Has non-empty child folder
            const childHasContent = child.children.some(c => c.url || (c.children && c.children.some(gc => gc.url)));
            return childHasContent;
          }
          return false;
        });

        if (!hasContent && node.title !== '') {
          emptyFolderIds.push(node.id);
        }

        // Recursively check children
        for (const child of node.children) {
          findEmptyFolders(child, currentPath);
        }
      }
    }

    for (const root of tree) {
      if (root.children) {
        for (const child of root.children) {
          findEmptyFolders(child, []);
        }
      }
    }

    // Delete empty folders (in reverse order to handle nested empty folders)
    for (const folderId of emptyFolderIds.reverse()) {
      try {
        await bookmarkService.removeBookmark(folderId);
        console.log(`Removed empty folder: ${folderId}`);
      } catch (error) {
        console.error(`Failed to remove empty folder ${folderId}:`, error);
      }
    }
  }

  /**
   * Abort current classification
   */
  abort(): void {
    this.abortController?.abort();
    this.isProcessing = false;
  }

  /**
   * Check if classification is in progress
   */
  isActive(): boolean {
    return this.isProcessing;
  }
}

// Export singleton instance
export const classifierService = new ClassifierService();
