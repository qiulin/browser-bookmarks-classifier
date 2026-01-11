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
      .map((s, i) => `${i + 1}. Title: ${s.title}\n   URL: ${s.url}\n   Content: ${s.content.substring(0, 1000)}...`)
      .join('\n\n');

    const systemPrompt = `You are an expert bookmark categorization assistant. Your task is to analyze bookmark samples and create a logical category hierarchy.

## CORE PRINCIPLES

1. **Categorize by TOPIC/TYPE, not format**
   ✅ Good: Technology/Programming, Design/Graphics, Business/Marketing
   ❌ Bad: Articles, Blogs, Videos, PDFs (these are formats, not topics)

2. **Create broad, inclusive categories**
   - Each category should accommodate 5-20 bookmarks
   - Avoid overly narrow categories (e.g., "React/Tutorials/Hooks")
   - Prefer broader themes with clear boundaries

3. **Use a logical hierarchy**
   - Maximum ${maxDepth} levels deep
   - Group related subcategories under parent categories
   - Example: Technology/Programming, Technology/AI, Technology/DevOps

4. **Use clear, descriptive names in ${this._getLanguageName(language)}**
   - Names should be self-explanatory
   - Use standard terminology (e.g., "Programming" not "Code Stuff")

## CLASSIFICATION STANDARDS

- **Tech & Development**: Programming languages, frameworks, tools, tutorials
- **Design**: UI, UX, graphics, typography, branding
- **Business**: Marketing, finance, entrepreneurship, management
- **Education**: Tutorials, courses, documentation, learning resources
- **Entertainment**: Movies, games, music, social media
- **News & Media**: News sites, magazines, journalism
- **Shopping**: E-commerce, product reviews, deals
- **Reference**: Documentation, wikis, specifications, dictionaries
- **Tools & Utilities**: Online tools, converters, calculators
- **Social & Community**: Forums, social networks, communities

## OUTPUT FORMAT

Return only JSON: { "categories": ["category/path", ...] }

Example: { "categories": ["Technology/Programming", "Technology/AI", "Design/UI", "Design/UX", "Business/Marketing", "Education/Tutorials", "Entertainment/Videos"] }`;

    const userPrompt = `Analyze these ${samples.length} bookmark samples and create ${maxCategories} well-structured categories:

## BOOKMARK SAMPLES

${samplesText}

## YOUR TASK

Create ${maxCategories} categories (max ${maxDepth} levels deep) that would effectively organize these bookmarks.

Requirements:
- Categories should be broad enough to group related bookmarks
- Use ${this._getLanguageName(language)} names
- Maximum ${maxDepth} directory levels
- Return as JSON: { "categories": ["path1", "path2", ...] }`;

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

    const systemPrompt = `You are an expert bookmark classification assistant. Your task is to categorize bookmarks into the most appropriate existing directory.

## CLASSIFICATION PRIORITIES (in order)

1. **URL Domain & Path** (highest priority)
   - The domain often reveals the primary topic
   - Examples: github.com → Development, dribbble.com → Design
   - Consider subdomains: docs.python.org → Reference, blog.example.com → Articles

2. **Page Title** (second priority)
   - Titles usually contain key topic keywords
   - Look for technology names, topics, or formats
   - Examples: "React Tutorial" → Programming, "Design System" → Design

3. **Page Content** (context and confirmation)
   - Use to confirm or refine classification from URL/title
   - Look at headings, main topics, and overall theme

## DECISION GUIDELINES

1. **Prefer existing categories over creating new ones**
   - Only create new path if NO existing category fits (>= 80% mismatch)

2. **Choose the most specific appropriate category**
   - Technology/Programming over Technology (if programming-related)
   - But don't over-specialize if content is general

3. **Handle edge cases**
   - Tutorial/documentation → Use the *topic* category (e.g., Programming Tutorial → Technology/Programming)
   - Tools/utilities → Tools & Utilities or topic-specific category
   - News/articles → Use the *topic* category (e.g., Tech News → Technology)
   - Multi-topic sites → Choose the primary/dominant topic

4. **Consider the website's main purpose**
   - Developer tools → Technology/Programming or Tools & Utilities
   - Design resources → Design/UI or Design/Graphics
   - Learning platforms → Education/Tutorials

## OUTPUT FORMAT

Return only JSON: { "path": "existing/path", "reason": "brief explanation of why this category fits" }

## EXAMPLES

Input: github.com/facebook/react
Output: { "path": "Technology/Programming", "reason": "GitHub repository for React, a JavaScript programming library" }

Input: dribbble.com/shots/design-system
Output: { "path": "Design/UI", "reason": "Dribbble is a design community, this is a UI design system shot" }

Input: medium.com/article-about-ai
Output: { "path": "Technology/AI", "reason": "Article about AI technology published on Medium" }`;

    const userPrompt = `## BOOKMARK TO CLASSIFY

**Title:** ${title}
**URL:** ${url}
**Content Preview:**
${content.substring(0, 1500)}${content.length > 1500 ? '...' : ''}

## AVAILABLE DIRECTORIES

${existingCategories.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## YOUR TASK

Analyze this bookmark and select the SINGLE most appropriate directory from the list above.

Requirements:
- Path must have at most ${maxDepth} levels
- Use ${this._getLanguageName(language)} directory names if suggesting new path
- Return JSON: { "path": "selected/path", "reason": "why this fits" }

Think step-by-step:
1. What is the main topic/domain?
2. Which existing categories relate to this topic?
3. Which is the BEST fit?
4. If none fit well (>= 80% mismatch), you may suggest a new path`;

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
        temperature: 0.2, // Lower temperature for more consistent, deterministic classification
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
