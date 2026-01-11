import type { ExtensionConfig } from '../types';

/**
 * Parsed rule structure
 */
export interface Rule {
  condition: string;
  category: string;
  raw: string;
}

/**
 * Rules Service - Parse and apply custom classification rules
 */
class RulesService {
  /**
   * Parse custom rules from markdown format
   * @param rulesText - Rules in markdown format (one per line)
   * @returns Array of parsed rules
   */
  parseRules(rulesText: string): Rule[] {
    const rules: Rule[] = [];
    const lines = rulesText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('-')) {
        continue;
      }

      // Parse format: "- 如果是[condition], 则分类为 [category]"
      // Or: "- If [condition], classify as [category]"
      const match = trimmed.match(/^-\s*(?:如果是|If)\s+(.+?)\s*(?:，|,)\s*(?:则分类为|classify\s+as|classify as)\s+(.+)$/);

      if (match) {
        const condition = match[1].trim();
        const category = match[2].trim();
        rules.push({
          condition,
          category,
          raw: trimmed,
        });
      }
    }

    return rules;
  }

  /**
   * Check if a bookmark matches any rule
   * @param bookmark - Bookmark to check
   * @param content - Page content
   * @param rules - Parsed rules
   * @returns Matching category or null
   */
  matchRule(
    bookmark: chrome.bookmarks.BookmarkTreeNode,
    content: string,
    rules: Rule[]
  ): string | null {
    if (rules.length === 0) {
      return null;
    }

    const url = bookmark.url || '';
    const title = bookmark.title || '';
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();

    for (const rule of rules) {
      if (this._evaluateRule(rule.condition, url, title, content, urlLower, titleLower)) {
        return rule.category;
      }
    }

    return null;
  }

  /**
   * Evaluate a single rule condition
   */
  private _evaluateRule(
    condition: string,
    url: string,
    _title: string,
    content: string,
    urlLower: string,
    titleLower: string
  ): boolean {
    const cond = condition.toLowerCase();

    // URL contains check
    if (cond.includes('url包含') || cond.includes('url contains')) {
      const match = cond.match(/(?:url包含|url contains)\s+["']?([^"']+)["']?/);
      if (match) {
        const keyword = match[1].toLowerCase();
        return urlLower.includes(keyword);
      }
    }

    // URL is check
    if (cond.includes('url是') || cond.includes('url is')) {
      const match = cond.match(/(?:url是|url is)\s+(.+?)(?:\s|$)/);
      if (match) {
        const targetUrl = match[1].trim().toLowerCase();
        return urlLower === targetUrl || urlLower.startsWith(targetUrl);
      }
    }

    // Domain check
    if (cond.includes('域名') || cond.includes('domain')) {
      const match = cond.match(/(?:域名|domain)\s+(?:是|is)?\s*["']?([^"']+)["']?/);
      if (match) {
        const domain = match[1].toLowerCase();
        try {
          const urlObj = new URL(url);
          return urlObj.hostname.toLowerCase().includes(domain);
        } catch {
          return false;
        }
      }
    }

    // Title contains check
    if (cond.includes('标题包含') || cond.includes('title contains')) {
      const match = cond.match(/(?:标题包含|title contains)\s+["']?([^"']+)["']?/);
      if (match) {
        const keyword = match[1].toLowerCase();
        return titleLower.includes(keyword);
      }
    }

    // Path contains check
    if (cond.includes('路径包含') || cond.includes('path contains')) {
      const match = cond.match(/(?:路径包含|path contains)\s+["']?([^"']+)["']?/);
      if (match) {
        const keyword = match[1].toLowerCase();
        return urlLower.includes(keyword);
      }
    }

    // Homepage check (根路径)
    if (cond.includes('首页') || cond.includes('homepage') || cond.includes('根路径')) {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        // Check if it's a homepage (root path or just domain)
        return path === '/' || path === '' || path === '/index.html' || path === '/index.htm';
      } catch {
        return false;
      }
    }

    // Content contains check
    if (cond.includes('内容包含') || cond.includes('content contains')) {
      const match = cond.match(/(?:内容包含|content contains)\s+["']?([^"']+)["']?/);
      if (match) {
        const keyword = match[1].toLowerCase();
        return content.toLowerCase().includes(keyword);
      }
    }

    return false;
  }

  /**
   * Get rules from config
   */
  getRules(config: ExtensionConfig): Rule[] {
    return this.parseRules(config.customRules || '');
  }
}

// Export singleton instance
export const rulesService = new RulesService();
