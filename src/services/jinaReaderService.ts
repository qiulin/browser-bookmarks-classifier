import { retryWithBackoff, RETRY_DELAY_MS, MAX_API_RETRIES } from '../utils/helpers';
import type { PageContent } from '../types';

/**
 * Jina Reader Service - Fetch page content using Jina Reader API
 */
class JinaReaderService {
  private apiKey: string = '';
  private baseUrl: string = 'https://r.jina.ai/http://';

  /**
   * Set API key for Jina Reader
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Fetch page content using Jina Reader API
   * @param url - URL to fetch
   * @returns Page content
   */
  async fetchPageContent(url: string): Promise<PageContent> {
    if (!this.apiKey) {
      throw new Error('Jina Reader API key is not configured');
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    return retryWithBackoff(
      async () => this._fetchPageContent(url),
      MAX_API_RETRIES,
      RETRY_DELAY_MS
    );
  }

  /**
   * Internal method to fetch page content
   */
  private async _fetchPageContent(url: string): Promise<PageContent> {
    const fetchUrl = `${this.baseUrl}${url}`;

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jina Reader API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Jina Reader returns markdown content directly
    const markdown = await response.text();

    // Extract title from markdown or URL
    const title = this._extractTitle(markdown, url);

    // Clean up markdown content
    const content = this._cleanMarkdown(markdown);

    return {
      title,
      content,
      url,
    };
  }

  /**
   * Extract title from markdown content
   */
  private _extractTitle(markdown: string, url: string): string {
    // Try to extract title from first heading
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    // Try to extract from first line
    const firstLine = markdown.split('\n')[0].trim();
    if (firstLine && !firstLine.startsWith('#')) {
      return firstLine.substring(0, 100);
    }

    // Fallback to URL
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Clean markdown content
   */
  private _cleanMarkdown(markdown: string): string {
    // Remove excessive whitespace
    let cleaned = markdown.replace(/\n{3,}/g, '\n\n');

    // Remove common navigation/footer patterns
    const patternsToRemove = [
      /^#+\s*(Skip to main content|Menu|Search)$/gim,
      /^\[.*?\]\(.*?\)\s*$/gm,  // Remove markdown links that might be navigation
    ];

    for (const pattern of patternsToRemove) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Trim and limit length
    cleaned = cleaned.trim();

    // Limit to reasonable size for LLM processing
    const maxLength = 10000;
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength) + '...';
    }

    return cleaned;
  }
}

// Export singleton instance
export const jinaReaderService = new JinaReaderService();
