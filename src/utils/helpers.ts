// Sleep utility for delays
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Retry utility with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// Check if a bookmark node is a folder
export function isFolder(node: chrome.bookmarks.BookmarkTreeNode): boolean {
  return !node.url;
}

// Get folder path from a bookmark node
export function getFolderPath(
  node: chrome.bookmarks.BookmarkTreeNode,
  tree: chrome.bookmarks.BookmarkTreeNode[]
): string[] {
  const path: string[] = [];

  function findNode(currentNode: chrome.bookmarks.BookmarkTreeNode, targetId: string): boolean {
    if (currentNode.id === targetId) {
      path.unshift(currentNode.title);
      return true;
    }

    if (currentNode.children) {
      for (const child of currentNode.children) {
        if (findNode(child, targetId)) {
          if (currentNode.id !== '0') { // Don't add root
            path.unshift(currentNode.title);
          }
          return true;
        }
      }
    }

    return false;
  }

  for (const root of tree) {
    if (findNode(root, node.id)) {
      break;
    }
  }

  return path;
}

// Parse directory path (e.g., "Tech/Programming" -> ["Tech", "Programming"])
export function parsePath(path: string): string[] {
  return path.split('/').filter(p => p.trim().length > 0);
}

// Join path parts
export function joinPath(parts: string[]): string {
  return parts.filter(p => p.trim().length > 0).join('/');
}

// Sample array based on rate
export function sampleArray<T>(array: T[], rate: number): T[] {
  const sampleSize = Math.max(1, Math.floor(array.length * rate));
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, sampleSize);
}

// Batch array
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

// Truncate text to max length
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Check if URL is valid
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Generate a simple hash for a string
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Format date to readable string
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

// Convert bookmarks tree to flat list
export function flattenBookmarks(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  excludeFolderTitles: string[] = []
): chrome.bookmarks.BookmarkTreeNode[] {
  const result: chrome.bookmarks.BookmarkTreeNode[] = [];

  function traverse(node: chrome.bookmarks.BookmarkTreeNode, isInExcluded: boolean = false) {
    // Check if this node is an excluded folder
    const nodeIsExcluded = !node.url && excludeFolderTitles.includes(node.title);

    // If parent is excluded or this node is excluded, skip traversal
    if (isInExcluded || nodeIsExcluded) {
      return;
    }

    // Only add bookmarks (not folders) to the result
    if (node.url) {
      result.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child, false);
      }
    }
  }

  for (const node of nodes) {
    traverse(node, false);
  }

  return result;
}

// Check if bookmark is in a specific folder
export function isBookmarkInFolder(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  folderPath: string[],
  tree: chrome.bookmarks.BookmarkTreeNode[]
): boolean {
  const path = getFolderPath(bookmark, tree);
  return path.slice(0, folderPath.length).join('/') === folderPath.join('/');
}
