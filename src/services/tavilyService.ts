import { TAVILY_API_ENDPOINT, MAX_API_RETRIES, RETRY_DELAY_MS } from '../utils/constants';
import { retryWithBackoff, sleep } from '../utils/helpers';
import type { PageContent } from '../types';

/**
 * Tavily API Service
 * Uses Tavily Search API to fetch page content for bookmark classification
 */
class TavilyService {
  private apiKey: string = '';

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Get API key
   */
  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Check if API key is set
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Fetch page content using Tavily API
   * @param url - URL to fetch content from
   * @returns Page content with title and text
   */
  async fetchPageContent(url: string): Promise<PageContent> {
    if (!this.isConfigured()) {
      throw new Error('Tavily API key is not configured');
    }

    return retryWithBackoff(
      () => this._fetchPageContent(url),
      MAX_API_RETRIES,
      RETRY_DELAY_MS
    );
  }

  /**
   * Internal method to fetch page content
   */
  private async _fetchPageContent(url: string): Promise<PageContent> {
    try {
      const response = await fetch(TAVILY_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: url,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: true,
          max_results: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Tavily API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error('No results returned from Tavily API');
      }

      const result = data.results[0];

      return {
        title: result.title || '',
        content: result.content || '',
        url: result.url || url,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch page content: ${String(error)}`);
    }
  }

  /**
   * Fetch multiple page contents in batch
   * @param urls - Array of URLs to fetch
   * @param batchSize - Number of concurrent requests
   * @returns Array of page contents
   */
  async fetchMultiplePageContents(
    urls: string[],
    batchSize: number = 5
  ): Promise<(PageContent | null)[]> {
    const results: (PageContent | null)[] = [];

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.fetchPageContent(url))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Failed to fetch page content:', result.reason);
          results.push(null);
        }
      }

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < urls.length) {
        await sleep(500);
      }
    }

    return results;
  }

  /**
   * Extract meaningful content from page content
   * @param content - Raw page content
   * @param maxLength - Maximum length of extracted content
   * @returns Extracted and cleaned content
   */
  extractContent(content: string, maxLength: number = 2000): string {
    // Remove extra whitespace
    let cleaned = content.replace(/\s+/g, ' ').trim();

    // Truncate if too long
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
      // Try to end at a sentence boundary
      const lastPeriod = cleaned.lastIndexOf('.');
      if (lastPeriod > maxLength * 0.8) {
        cleaned = cleaned.substring(0, lastPeriod + 1);
      }
    }

    return cleaned;
  }
}

// Export singleton instance
export const tavilyService = new TavilyService();
