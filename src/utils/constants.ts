import { ExtensionConfig } from '../types';

// Storage Keys
export const STORAGE_KEY_CONFIG = 'bookmark_classifier_config';
export const STORAGE_KEY_PROGRESS = 'bookmark_classifier_progress';

// API Endpoints
export const TAVILY_API_ENDPOINT = 'https://api.tavily.com/search';

// Archive folder name
export const ARCHIVE_FOLDER_NAME = 'Archive';

// Default TODO folder name
export const DEFAULT_TODO_FOLDER_NAME = 'TODO';

// Max retries for API calls
export const MAX_API_RETRIES = 3;

// Retry delay in milliseconds
export const RETRY_DELAY_MS = 1000;

// Processing batch size
export const BATCH_SIZE = 5;

// Default configuration
export const DEFAULT_CONFIG: ExtensionConfig = {
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiApiKey: '',
  tavilyApiKey: '',
  initSampleRate: 0.2,
  maxCategories: 10,
  excludedDirs: [ARCHIVE_FOLDER_NAME],
  maxDirectoryDepth: 2,
  isInitialized: false,
  isProcessing: false,
  todoFolderName: DEFAULT_TODO_FOLDER_NAME,
};

// System prompts for LLM
export const CREATE_CATEGORIES_SYSTEM_PROMPT = `You are a bookmark categorization assistant. Analyze the provided bookmark samples and create appropriate category directories.

Guidelines:
- Create up to {max_categories} categories
- Each category should be broad enough to contain multiple bookmarks
- Use clear, descriptive category names
- Organize categories in a logical hierarchy (max {max_depth} levels)
- Return a JSON array of category paths

Example output format:
["Technology/Programming", "Technology/AI", "Design/Graphics", "Business/Marketing", "Entertainment/Movies"]`;

export const CLASSIFY_BOOKMARK_SYSTEM_PROMPT = `You are a bookmark classification assistant. Categorize the given bookmark into the most appropriate existing directory.

Instructions:
- Analyze the bookmark title, URL, and page content
- Choose the most suitable existing directory
- The directory path should have at most {max_depth} levels
- If no existing directory fits well, you may suggest a new one (but stay within {max_categories} total categories)

Return format: JSON { "path": "directory/subdirectory", "reason": "classification reasoning" }`;

export const CLASSIFY_BOOKMARK_USER_PROMPT = (title: string, url: string, content: string, directories: string[]) => `
Bookmark Information:
- Title: ${title}
- URL: ${url}
- Page Content: ${content.substring(0, 500)}...

Existing Directories:
${directories.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Please classify this bookmark into the most appropriate directory.`;
