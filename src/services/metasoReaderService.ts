import { retryWithBackoff } from '../utils/helpers';
import { RETRY_DELAY_MS, MAX_API_RETRIES } from '../utils/constants';
import type { PageContent } from '../types';

/**
 * Metaso AI Reader Service - Fetch page content using Metaso AI Reader API
 */
class MetasoReaderService {
  private apiKey: string = '';
  private baseUrl: string = 'https://metaso.cn/api/v1/reader';

  /**
   * Set API key for Metaso AI Reader
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Fetch page content using Metaso AI Reader API
   * @param url - URL to fetch
   * @returns Page content
   */
  async fetchPageContent(url: string): Promise<PageContent> {
    if (!this.apiKey) {
      throw new Error('Metaso AI Reader API key is not configured');
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
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'text/plain',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Metaso AI Reader API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Metaso returns plain text (markdown format)
    const text = await response.text();

    // Extract title and content from the response
    const { title, content } = this._parseResponse(text, url);

    return {
      title,
      content,
      url,
    };
  }

  /**
   * Parse response to extract title and content
   */
  private _parseResponse(text: string, url: string): { title: string; content: string } {
    // Try to extract title from markdown heading
    const titleMatch = text.match(/^#\s+(.+)$/m);
    let title = titleMatch ? titleMatch[1].trim() : '';

    // If no title found, extract from URL
    if (!title) {
      try {
        const urlObj = new URL(url);
        title = urlObj.hostname;
      } catch {
        title = url;
      }
    }

    // Clean up content
    const content = this._cleanContent(text);

    return { title, content };
  }

  /**
   * Clean content
   */
  private _cleanContent(content: string): string {
    // Remove excessive whitespace while preserving paragraph structure
    let cleaned = content.replace(/\n{3,}/g, '\n\n').trim();

    // Limit to reasonable size for LLM processing
    const maxLength = 10000;
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength) + '...';
    }

    return cleaned;
  }
}

// Export singleton instance
export const metasoReaderService = new MetasoReaderService();
