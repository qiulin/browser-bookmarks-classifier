import { MAX_API_RETRIES, RETRY_DELAY_MS } from '../utils/constants';
import { retryWithBackoff } from '../utils/helpers';
import type { ClassificationResult } from '../types';

/**
 * OpenAI-compatible API Service
 */
class OpenAIService {
  private baseUrl: string = 'https://api.openai.com/v1';
  private apiKey: string = '';
  private model: string = 'gpt-4o-mini'; // Default model

  /**
   * Set base URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Set model
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Get API key
   */
  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Create categories from sample bookmarks
   * @param samples - Array of page contents from sampled bookmarks
   * @param maxCategories - Maximum number of categories to create
   * @param maxDepth - Maximum directory depth
   * @param language - Language code for category names (e.g., 'en', 'zh')
   * @returns Array of category paths
   */
  async createCategories(
    samples: Array<{ title: string; url: string; content: string }>,
    maxCategories: number,
    maxDepth: number,
    language: string = 'en'
  ): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key is not configured');
    }

    const samplesText = samples
      .map((s, i) => `${i + 1}. Title: ${s.title}\n   URL: ${s.url}\n   Content: ${s.content.substring(0, 200)}...`)
      .join('\n\n');

    const systemPrompt = `You are a bookmark categorization assistant. Analyze the provided bookmark samples and create appropriate category directories.

Guidelines:
- Create up to ${maxCategories} categories
- Each category should be broad enough to contain multiple bookmarks
- Use clear, descriptive category names in ${this._getLanguageName(language)}
- Organize categories in a logical hierarchy (max ${maxDepth} levels)
- Return only JSON in the format: { "categories": ["category1", "category2", ...] }

Example output format: { "categories": ["Technology/Programming", "Technology/AI", "Design/Graphics", "Business/Marketing"] }`;

    const userPrompt = `Based on these bookmark samples, create appropriate categories:\n\n${samplesText}`;

    return retryWithBackoff(
      () => this._createCategories(systemPrompt, userPrompt),
      MAX_API_RETRIES,
      RETRY_DELAY_MS
    );
  }

  /**
   * Get language name from code
   */
  private _getLanguageName(code: string): string {
    const languageMap: Record<string, string> = {
      'en': 'English',
      'zh': 'Chinese (中文)',
      'ja': 'Japanese (日本語)',
      'ko': 'Korean (한국어)',
      'es': 'Spanish (Español)',
      'fr': 'French (Français)',
      'de': 'German (Deutsch)',
      'it': 'Italian (Italiano)',
      'pt': 'Portuguese (Português)',
      'ru': 'Russian (Русский)',
    };
    return languageMap[code] || 'English';
  }

  /**
   * Internal method to create categories
   */
  private async _createCategories(systemPrompt: string, userPrompt: string): Promise<string[]> {
    const response = await this._callChatAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Parse JSON response
    const content = response.choices[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(content);

      // Handle both formats: direct array or object with "categories" key
      let categories: string[];
      if (Array.isArray(parsed)) {
        categories = parsed;
      } else if (parsed.categories && Array.isArray(parsed.categories)) {
        categories = parsed.categories;
      } else {
        throw new Error('Response does not contain a categories array');
      }

      return categories.map((cat: string) => String(cat));
    } catch (error) {
      console.error('Failed to parse categories response:', content);
      throw new Error('Failed to parse categories from API response');
    }
  }

  /**
   * Classify a bookmark into a category
   * @param title - Bookmark title
   * @param url - Bookmark URL
   * @param content - Page content
   * @param existingCategories - List of existing category paths
   * @param maxDepth - Maximum directory depth
   * @param language - Language code for category names (e.g., 'en', 'zh')
   * @returns Classification result with path and reason
   */
  async classifyBookmark(
    title: string,
    url: string,
    content: string,
    existingCategories: string[],
    maxDepth: number,
    language: string = 'en'
  ): Promise<ClassificationResult> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key is not configured');
    }

    const systemPrompt = `You are a bookmark classification assistant. Categorize the given bookmark into the most appropriate existing directory.

Instructions:
- Analyze the bookmark title, URL, and page content
- Choose the most suitable existing directory from the provided list
- The directory path should have at most ${maxDepth} levels
- If no existing directory fits well, you may suggest a new path (use ${this._getLanguageName(language)} for directory names)
- Return only JSON in the format: { "path": "directory/subdirectory", "reason": "classification reasoning" }`;

    const userPrompt = `Bookmark Information:
- Title: ${title}
- URL: ${url}
- Page Content: ${content.substring(0, 500)}...

Existing Directories:
${existingCategories.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Please classify this bookmark into the most appropriate directory.`;

    return retryWithBackoff(
      () => this._classifyBookmark(systemPrompt, userPrompt),
      MAX_API_RETRIES,
      RETRY_DELAY_MS
    );
  }

  /**
   * Internal method to classify a bookmark
   */
  private async _classifyBookmark(systemPrompt: string, userPrompt: string): Promise<ClassificationResult> {
    const response = await this._callChatAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Parse JSON response
    const content = response.choices[0]?.message?.content || '{}';
    try {
      const result = JSON.parse(content);
      if (!result.path) {
        throw new Error('Response missing "path" field');
      }
      return {
        path: String(result.path),
        reason: result.reason || '',
      };
    } catch (error) {
      console.error('Failed to parse classification response:', content);
      throw new Error('Failed to parse classification from API response');
    }
  }

  /**
   * Call the OpenAI Chat Completions API
   */
  private async _callChatAPI(messages: Array<{ role: string; content: string }>) {
    const url = `${this.baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3, // Lower temperature for more consistent results
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this._callChatAPI([
        { role: 'user', content: 'Respond with JSON: {"status": "ok"}' },
      ]);
      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content);
      return result.status === 'ok';
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();
