import { tavilyService } from './tavilyService';
import { jinaReaderService } from './jinaReaderService';
import { metasaReaderService } from './metasaReaderService';
import type { PageContent } from '../types';

/**
 * Scraper Service - Unified interface for web scraping
 * Automatically uses the configured scraper (Tavily, Jina Reader, or Metasa AI)
 */
class ScraperService {
  private provider: 'tavily' | 'jina' | 'metasa' = 'tavily';

  /**
   * Set which scraper provider to use
   */
  setProvider(provider: 'tavily' | 'jina' | 'metasa'): void {
    this.provider = provider;
  }

  /**
   * Set API keys
   */
  setApiKeys(tavilyKey: string, jinaReaderKey: string, metasaReaderKey: string): void {
    tavilyService.setApiKey(tavilyKey);
    jinaReaderService.setApiKey(jinaReaderKey);
    metasaReaderService.setApiKey(metasaReaderKey);
  }

  /**
   * Fetch page content using the configured provider
   */
  async fetchPageContent(url: string): Promise<PageContent> {
    if (this.provider === 'jina') {
      return jinaReaderService.fetchPageContent(url);
    } else if (this.provider === 'metasa') {
      return metasaReaderService.fetchPageContent(url);
    } else {
      return tavilyService.fetchPageContent(url);
    }
  }

  /**
   * Get the current provider
   */
  getProvider(): 'tavily' | 'jina' | 'metasa' {
    return this.provider;
  }
}

// Export singleton instance
export const scraperService = new ScraperService();
