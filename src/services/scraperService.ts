import { tavilyService } from './tavilyService';
import { jinaReaderService } from './jinaReaderService';
import { metasoReaderService } from './metasoReaderService';
import type { PageContent } from '../types';

/**
 * Scraper Service - Unified interface for web scraping
 * Automatically uses the configured scraper (Tavily, Jina Reader, or Metaso AI)
 */
class ScraperService {
  private provider: 'tavily' | 'jina' | 'metaso' = 'tavily';

  /**
   * Set which scraper provider to use
   */
  setProvider(provider: 'tavily' | 'jina' | 'metaso'): void {
    this.provider = provider;
  }

  /**
   * Set API keys
   */
  setApiKeys(tavilyKey: string, jinaReaderKey: string, metasoReaderKey: string): void {
    tavilyService.setApiKey(tavilyKey);
    jinaReaderService.setApiKey(jinaReaderKey);
    metasoReaderService.setApiKey(metasoReaderKey);
  }

  /**
   * Fetch page content using the configured provider
   */
  async fetchPageContent(url: string): Promise<PageContent> {
    if (this.provider === 'jina') {
      return jinaReaderService.fetchPageContent(url);
    } else if (this.provider === 'metaso') {
      return metasoReaderService.fetchPageContent(url);
    } else {
      return tavilyService.fetchPageContent(url);
    }
  }

  /**
   * Get the current provider
   */
  getProvider(): 'tavily' | 'jina' | 'metaso' {
    return this.provider;
  }
}

// Export singleton instance
export const scraperService = new ScraperService();
