import { retryWithBackoff } from '../utils/helpers';
import { RETRY_DELAY_MS, MAX_API_RETRIES } from '../utils/constants';
import type { PageContent } from '../types';

/**
 * Metasa AI Reader Service - Fetch page content using Metasa AI Reader API
 */
class MetasaReaderService {
  private apiKey: string = '';
  private baseUrl: string = 'https://r.metasa.ai/api';

  /**
   * Set API key for Metasa AI Reader
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Fetch page content using Metasa AI Reader API
   * @param url - URL to fetch
   * @returns Page content
   */
  async fetchPageContent(url: string): Promise<PageContent> {
    if (!this.apiKey) {
      throw new Error('Metasa AI Reader API key is not configured');
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
    const response = await fetch(`${this.baseUrl}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        url: url,
        extract: 'content',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Metasa AI Reader API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    // Extract content from response
    const content = data.content || data.text || data.markdown || '';
    const title = data.title || this._extractTitleFromUrl(url);

    // Clean up content
    const cleanedContent = this._cleanContent(content);

    return {
      title,
      content: cleanedContent,
      url,
    };
  }

  /**
   * Extract title from URL
   */
  private _extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Clean content
   */
  private _cleanContent(content: string): string {
    // Remove excessive whitespace
    let cleaned = content.replace(/\s+/g, ' ').trim();

    // Limit to reasonable size for LLM processing
    const maxLength = 10000;
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength) + '...';
    }

    return cleaned;
  }
}

// Export singleton instance
export const metasaReaderService = new MetasaReaderService();
