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
   * @returns Array of category paths
   */
  async createCategories(
    samples: Array<{ title: string; url: string; content: string }>,
    maxCategories: number,
    maxDepth: number
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
- Use clear, descriptive category names
- Organize categories in a logical hierarchy (max ${maxDepth} levels)
- Return only a JSON array of category path strings

Example output format: ["Technology/Programming", "Technology/AI", "Design/Graphics", "Business/Marketing"]`;

    const userPrompt = `Based on these bookmark samples, create appropriate categories:\n\n${samplesText}`;

    return retryWithBackoff(
      () => this._createCategories(systemPrompt, userPrompt),
      MAX_API_RETRIES,
      RETRY_DELAY_MS
    );
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
    const content = response.choices[0]?.message?.content || '[]';
    try {
      const categories = JSON.parse(content);
      if (!Array.isArray(categories)) {
        throw new Error('Response is not an array');
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
   * @returns Classification result with path and reason
   */
  async classifyBookmark(
    title: string,
    url: string,
    content: string,
    existingCategories: string[],
    maxDepth: number
  ): Promise<ClassificationResult> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key is not configured');
    }

    const systemPrompt = `You are a bookmark classification assistant. Categorize the given bookmark into the most appropriate existing directory.

Instructions:
- Analyze the bookmark title, URL, and page content
- Choose the most suitable existing directory from the provided list
- The directory path should have at most ${maxDepth} levels
- If no existing directory fits well, you may suggest a new path
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
