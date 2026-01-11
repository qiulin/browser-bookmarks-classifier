import { tavilyService } from './tavilyService';
import { jinaReaderService } from './jinaReaderService';
import type { PageContent } from '../types';

/**
 * Scraper Service - Unified interface for web scraping
 * Automatically uses the configured scraper (Tavily or Jina Reader)
 */
class ScraperService {
  private provider: 'tavily' | 'jina' = 'tavily';

  /**
   * Set which scraper provider to use
   */
  setProvider(provider: 'tavily' | 'jina'): void {
    this.provider = provider;
  }

  /**
   * Set API keys
   */
  setApiKeys(tavilyKey: string, jinaReaderKey: string): void {
    tavilyService.setApiKey(tavilyKey);
    jinaReaderService.setApiKey(jinaReaderKey);
  }

  /**
   * Fetch page content using the configured provider
   */
  async fetchPageContent(url: string): Promise<PageContent> {
    if (this.provider === 'jina') {
      return jinaReaderService.fetchPageContent(url);
    } else {
      return tavilyService.fetchPageContent(url);
    }
  }

  /**
   * Get the current provider
   */
  getProvider(): 'tavily' | 'jina' {
    return this.provider;
  }
}

// Export singleton instance
export const scraperService = new ScraperService();
