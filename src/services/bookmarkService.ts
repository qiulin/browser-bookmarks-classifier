import { BACKUP_FOLDER_NAME } from '../utils/constants';
import { flattenBookmarks, isFolder, parsePath } from '../utils/helpers';

/**
 * Bookmark Service - Wrapper for Chrome Bookmarks API
 */
class BookmarkService {
  /**
   * Get the entire bookmark tree
   */
  async getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getTree((tree) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tree);
        }
      });
    });
  }

  /**
   * Get all bookmarks as a flat list (excluding folders)
   * @param excludedFolderTitles - Folder titles to exclude
   */
  async getAllBookmarks(excludedFolderTitles: string[] = []): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    const tree = await this.getTree();
    return flattenBookmarks(tree, excludedFolderTitles);
  }

  /**
   * Get bookmarks in a specific folder
   * @param folderId - ID of the folder
   */
  async getBookmarksInFolder(folderId: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(folderId, (children) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(children);
        }
      });
    });
  }

  /**
   * Get a bookmark by ID
   * @param id - Bookmark ID
   */
  async getBookmark(id: string): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get(id, (results) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(results[0]);
        }
      });
    });
  }

  /**
   * Search bookmarks by query
   * @param query - Search query
   */
  async searchBookmarks(query: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.search(query, (results) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(results);
        }
      });
    });
  }

  /**
   * Create a new folder
   * @param title - Folder title
   * @param parentId - Parent folder ID (defaults to bookmarks bar)
   */
  async createFolder(title: string, parentId?: string): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(
        {
          title,
          parentId,
        },
        (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Create a nested folder path (e.g., "Tech/Programming" creates "Tech" then "Programming")
   * @param path - Folder path (e.g., "Tech/Programming")
   * @param rootParentId - Root parent folder ID
   * @returns The ID of the deepest folder
   */
  async createFolderPath(path: string, rootParentId?: string): Promise<string> {
    const parts = parsePath(path);
    let parentId = rootParentId || await this.getDefaultFolderId();

    for (const part of parts) {
      // Check if folder already exists
      const siblings = await this.getBookmarksInFolder(parentId);
      const existing = siblings.find(
        (s) => isFolder(s) && s.title === part
      );

      if (existing) {
        parentId = existing.id;
      } else {
        const newFolder = await this.createFolder(part, parentId);
        parentId = newFolder.id;
      }
    }

    return parentId;
  }

  /**
   * Get or create a folder by path
   * @param path - Folder path
   * @param rootParentId - Root parent folder ID
   * @returns The ID of the folder
   */
  async getOrCreateFolder(path: string, rootParentId?: string): Promise<string> {
    return this.createFolderPath(path, rootParentId);
  }

  /**
   * Move a bookmark to a new folder
   * @param id - Bookmark ID
   * @param targetFolderId - Target folder ID
   * @param index - Optional index position
   */
  async moveBookmark(
    id: string,
    targetFolderId: string,
    index?: number
  ): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.move(
        id,
        {
          parentId: targetFolderId,
          index,
        },
        (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Copy a bookmark tree to a new folder
   * @param sourceId - Source folder or bookmark ID
   * @param targetParentId - Target parent folder ID
   * @param newTitle - Optional new title for the copied folder
   */
  async copyBookmarkTree(
    sourceId: string,
    targetParentId: string,
    newTitle?: string
  ): Promise<void> {
    const source = await this.getBookmark(sourceId);

    if (isFolder(source)) {
      // Create folder copy
      const folderCopy = await this.createFolder(
        newTitle || source.title,
        targetParentId
      );

      // Copy children recursively
      if (source.children) {
        for (const child of source.children) {
          await this.copyBookmarkTree(child.id, folderCopy.id);
        }
      }
    } else if (source.url) {
      // Create bookmark copy
      await new Promise<void>((resolve, reject) => {
        chrome.bookmarks.create(
          {
            title: source.title,
            url: source.url,
            parentId: targetParentId,
          },
          () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          }
        );
      });
    }
  }

  /**
   * Create Backup folder and backup all bookmarks
   * @returns Backup folder ID
   */
  async createArchive(): Promise<string> {
    const tree = await this.getTree();
    // Get the first child of root (usually Bookmarks Bar)
    // We cannot create folders directly under root
    const rootChildren = tree[0].children || [];
    const defaultFolderId = rootChildren[0]?.id;

    if (!defaultFolderId) {
      throw new Error('No suitable parent folder found for Backup');
    }

    // Check if Backup folder already exists
    const siblings = await this.getBookmarksInFolder(defaultFolderId);
    const backupFolder = siblings.find(
      (s) => isFolder(s) && s.title === BACKUP_FOLDER_NAME
    );

    let backupFolderId: string;

    if (backupFolder) {
      backupFolderId = backupFolder.id;
    } else {
      const newBackup = await this.createFolder(BACKUP_FOLDER_NAME, defaultFolderId);
      backupFolderId = newBackup.id;
    }

    // Backup all folders (except Backup itself)
    for (const sibling of siblings) {
      if (isFolder(sibling) && sibling.title !== BACKUP_FOLDER_NAME) {
        await this.copyBookmarkTree(sibling.id, backupFolderId);
      }
    }

    return backupFolderId;
  }

  /**
   * Find folder by path from root
   * @param path - Folder path parts (e.g., ["Tech", "Programming"])
   * @param tree - Bookmark tree
   * @returns Folder ID or null if not found
   */
  findFolderByPath(
    path: string[],
    tree: chrome.bookmarks.BookmarkTreeNode[]
  ): string | null {
    for (const node of tree) {
      if (isFolder(node) && node.title === path[0]) {
        if (path.length === 1) {
          return node.id;
        }
        if (node.children) {
          const result = this.findFolderByPath(path.slice(1), node.children);
          if (result) return result;
        }
      }
    }
    return null;
  }

  /**
   * Get the default folder for new bookmarks (usually Bookmarks Bar)
   */
  async getDefaultFolderId(): Promise<string> {
    const tree = await this.getTree();
    // Get the first child of root (usually Bookmarks Bar)
    // Root has children like "Bookmarks Bar", "Other Bookmarks", "Mobile Bookmarks"
    const rootChildren = tree[0].children || [];

    if (rootChildren.length === 0) {
      throw new Error('No bookmark folders found');
    }

    // Return the first folder (usually "Bookmarks Bar" or its localized name)
    return rootChildren[0].id;
  }

  /**
   * Check if a folder exists
   * @param title - Folder title
   * @param parentId - Parent folder ID
   */
  async folderExists(title: string, parentId?: string): Promise<boolean> {
    const parent = parentId || await this.getDefaultFolderId();
    const siblings = await this.getBookmarksInFolder(parent);
    return siblings.some((s) => isFolder(s) && s.title === title);
  }

  /**
   * Delete a bookmark or folder
   * @param id - Bookmark or folder ID
   */
  async removeBookmark(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.removeTree(id, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get bookmark statistics
   */
  async getStatistics(): Promise<{
    totalBookmarks: number;
    totalFolders: number;
    bookmarksByFolder: Record<string, number>;
  }> {
    const tree = await this.getTree();
    let totalBookmarks = 0;
    let totalFolders = 0;
    const bookmarksByFolder: Record<string, number> = {};

    function traverse(node: chrome.bookmarks.BookmarkTreeNode, path: string = '') {
      const currentPath = path ? `${path}/${node.title}` : node.title;

      if (isFolder(node)) {
        totalFolders++;
        if (node.children) {
          let folderCount = 0;
          for (const child of node.children) {
            if (!isFolder(child)) {
              folderCount++;
            }
          }
          bookmarksByFolder[currentPath] = folderCount;

          for (const child of node.children) {
            traverse(child, currentPath);
          }
        }
      } else {
        totalBookmarks++;
      }
    }

    for (const root of tree) {
      if (root.children) {
        for (const child of root.children) {
          traverse(child);
        }
      }
    }

    return {
      totalBookmarks,
      totalFolders,
      bookmarksByFolder,
    };
  }
}

// Export singleton instance
export const bookmarkService = new BookmarkService();
