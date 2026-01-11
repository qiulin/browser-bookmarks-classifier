import { scraperService } from './scraperService';
import { openaiService } from './openaiService';
import { bookmarkService } from './bookmarkService';
import { storageService } from './storage';
import { rulesService } from './rulesService';
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
      scraperService.setProvider(config.scraperProvider);
      scraperService.setApiKeys(config.tavilyApiKey, config.jinaReaderApiKey, config.metasoReaderApiKey);
      openaiService.setBaseUrl(config.openaiBaseUrl);
      openaiService.setApiKey(config.openaiApiKey);
      openaiService.setModel(config.llmModel);

      await this._runInitialization(config, progressCallback);
    } catch (error) {
      // Handle abort as normal cancellation, not an error
      if (error instanceof Error && error.message === 'Aborted') {
        progressCallback?.({
          current: 0,
          total: 0,
          message: 'Initialization cancelled by user',
          stage: 'complete',
        });
        return;
      }
      throw error; // Re-throw other errors
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

    let categories: string[] = [];

    // Check if predefined categories are provided
    if (config.predefinedCategories && config.predefinedCategories.trim().length > 0) {
      // Parse predefined categories (one per line)
      categories = config.predefinedCategories
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (categories.length === 0) {
        throw new Error('No valid predefined categories found');
      }

      progressCallback?.({
        current: sampledBookmarks.length,
        total,
        message: `Using ${categories.length} predefined categories...`,
        stage: 'categorizing',
      });
    } else {
      // Use AI to generate categories
      const validSampleData = sampleData.filter(d => d !== null) as Array<{
        title: string;
        url: string;
        content: string;
      }>;

      if (validSampleData.length === 0) {
        throw new Error('Failed to fetch content for sample bookmarks');
      }

      categories = await openaiService.createCategories(
        validSampleData,
        config.maxCategories,
        config.maxDirectoryDepth,
        config.defaultLanguage
      );
    }

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
    const concurrency = config.classificationConcurrency || 10;

    // Parse custom rules
    const rules = rulesService.getRules(config);

    // Filter bookmarks with URLs
    const bookmarksToClassify = allBookmarks.filter(b => b.url);

    // Classify with concurrency
    for (let i = 0; i < bookmarksToClassify.length; i += concurrency) {
      if (signal.aborted) throw new Error('Aborted');

      const batch = bookmarksToClassify.slice(i, i + concurrency);

      // Create a promise that rejects when aborted
      const abortPromise = new Promise<never>((_, reject) => {
        if (signal.aborted) {
          reject(new Error('Aborted'));
        } else {
          signal.addEventListener('abort', () => {
            reject(new Error('Aborted'));
          });
        }
      });

      // Process batch with abort capability
      const batchPromise = Promise.allSettled(
        batch.map(async (bookmark) => {
          try {
            // Check abort before processing
            if (signal.aborted) throw new Error('Aborted');

            const result = await this._classifySingleBookmark(
              bookmark,
              existingCategories,
              config.maxDirectoryDepth,
              rootFolderId,
              signal,
              config.defaultLanguage,
              rules
            );

            // Check abort before moving
            if (signal.aborted) throw new Error('Aborted');

            // Move to classified folder
            await bookmarkService.moveBookmark(bookmark.id!, result.folderId);

            return { success: true, bookmark };
          } catch (error) {
            // Check if this is an abort error
            if (error instanceof Error && error.message === 'Aborted') {
              throw error; // Re-throw abort errors
            }
            console.error(`Failed to classify bookmark ${bookmark.title}:`, error);

            // Check abort before moving to failures
            if (signal.aborted) throw new Error('Aborted');

            // Move to Failures folder
            try {
              await bookmarkService.moveBookmark(bookmark.id!, failuresFolderId);
            } catch (moveError) {
              console.error(`Failed to move bookmark to Failures folder:`, moveError);
            }
            return { success: false, bookmark };
          }
        })
      );

      // Race between batch processing and abort - abort wins
      const results = await Promise.race([
        batchPromise,
        abortPromise.then(() => {
          throw new Error('Aborted');
        })
      ]) as PromiseSettledResult<{ success: boolean; bookmark: chrome.bookmarks.BookmarkTreeNode }>[];

      // Update counters and progress
      for (const result of results) {
        if (result.status === 'fulfilled') {
          classified++;
          if (!result.value.success) {
            failed++;
          }
        } else {
          classified++;
          failed++;
        }
      }

      // Report progress for last item in batch
      if (batch.length > 0) {
        progressCallback?.({
          current: classified,
          total,
          message: `Classified: ${batch[batch.length - 1].title}`,
          stage: 'classifying',
        });
      }
    }

    // Count bookmarks without URLs as classified
    const bookmarksWithoutUrl = allBookmarks.length - bookmarksToClassify.length;
    classified += bookmarksWithoutUrl;

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

    // Create TODO folder
    progressCallback?.({
      current: total,
      total,
      message: 'Creating TODO folder...',
      stage: 'complete',
    });
    try {
      await bookmarkService.createFolderPath(config.todoFolderName, rootFolderId);
    } catch (error) {
      // TODO folder might already exist, ignore error
      console.info('TODO folder creation:', error);
    }

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
    scraperService.setProvider(config.scraperProvider);
    scraperService.setApiKeys(config.tavilyApiKey, config.jinaReaderApiKey, config.metasoReaderApiKey);
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

    // Parse custom rules
    const rules = rulesService.getRules(config);

    const result = await this._classifySingleBookmark(
      bookmark,
      categories,
      config.maxDirectoryDepth,
      rootFolderId,
      undefined,
      config.defaultLanguage,
      rules
    );

    // Actually move the bookmark to the target folder
    await bookmarkService.moveBookmark(bookmark.id!, result.folderId);

    return result;
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
    language: string = 'en',
    rules: any[] = []
  ): Promise<{ path: string; folderId: string }> {
    // Check abort before starting
    if (signal?.aborted) throw new Error('Aborted');

    // Fetch page content
    const content = await scraperService.fetchPageContent(bookmark.url!);

    if (signal?.aborted) throw new Error('Aborted');

    // Check custom rules first
    const ruleMatch = rulesService.matchRule(bookmark, content.content, rules);
    if (ruleMatch) {
      const folderId = await bookmarkService.getOrCreateFolder(ruleMatch, rootFolderId);
      return {
        path: ruleMatch,
        folderId,
      };
    }

    // Classify using OpenAI
    const result = await openaiService.classifyBookmark(
      bookmark.title,
      bookmark.url!,
      content.content,
      existingCategories,
      maxDepth,
      language
    );

    if (signal?.aborted) throw new Error('Aborted');

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
            const content = await scraperService.fetchPageContent(bookmark.url);
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
   * Excludes root-level folders (Bookmarks Bar, Other Bookmarks, etc.)
   */
  private _extractExistingCategories(
    tree: chrome.bookmarks.BookmarkTreeNode[]
  ): string[] {
    const categories: string[] = [];

    function traverse(node: chrome.bookmarks.BookmarkTreeNode, path: string[] = [], isRootLevel: boolean = false) {
      // Don't add root-level folder names to the path
      const currentPath = isRootLevel ? path : [...path, node.title];

      // Only add folders that are direct children of root or at depth 2
      if (node.children && node.children.length > 0) {
        // Check if this folder has bookmarks (is a category)
        const hasBookmarks = node.children.some(child => child.url);
        if (hasBookmarks && currentPath.length > 0) {
          categories.push(currentPath.join('/'));
        }

        // Recursively process children
        for (const child of node.children) {
          traverse(child, currentPath, false);
        }
      }
    }

    for (const root of tree) {
      if (root.children) {
        for (const child of root.children) {
          // Pass isRootLevel=true for children of root (Bookmarks Bar, Other Bookmarks, etc.)
          traverse(child, [], true);
        }
      }
    }

    return categories;
  }

  /**
   * Clean up empty folders after classification
   * @param _rootFolderId - Root folder ID (unused, kept for interface consistency)
   * @param excludeFolders - Folder names to exclude from cleanup
   */
  private async _cleanupEmptyFolders(
    _rootFolderId: string,
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
