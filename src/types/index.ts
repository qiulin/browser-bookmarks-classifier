// Extension Configuration
export interface ExtensionConfig {
  // OpenAI Configuration
  openaiBaseUrl: string;
  openaiApiKey: string;
  llmModel: string;          // LLM model name, default 'gpt-4o-mini'

  // Tavily Configuration
  tavilyApiKey: string;

  // Jina Reader Configuration
  jinaReaderApiKey: string;

  // Metasa AI Reader Configuration
  metasaReaderApiKey: string;

  // Scraper Provider Selection
  scraperProvider: 'tavily' | 'jina' | 'metasa';  // Which scraper to use

  // Initialization Configuration
  initSampleRate: number;      // Sample rate, default 0.2 (20%)
  maxCategories: number;       // Maximum number of categories, default 10
  excludedDirs: string[];      // List of directory names to exclude

  // Directory Depth
  maxDirectoryDepth: number;   // Maximum directory depth, default 2

  // State
  isInitialized: boolean;      // Whether initialization is complete
  isProcessing: boolean;       // Whether processing is in progress

  // TODO Folder Configuration
  todoFolderName: string;      // Default "TODO"
  checkInterval: number;       // Check interval in ms, default 60000 (1 minute)

  // Language Configuration
  defaultLanguage: string;     // Default language for category names, e.g., 'en', 'zh', 'ja'
}

// Default configuration
export const DEFAULT_CONFIG: ExtensionConfig = {
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiApiKey: '',
  llmModel: 'gpt-4o-mini',
  tavilyApiKey: '',
  jinaReaderApiKey: '',
  metasaReaderApiKey: '',
  scraperProvider: 'tavily',
  initSampleRate: 0.2,
  maxCategories: 10,
  excludedDirs: [],
  maxDirectoryDepth: 2,
  isInitialized: false,
  isProcessing: false,
  todoFolderName: 'TODO',
  checkInterval: 60000, // 1 minute in milliseconds
  defaultLanguage: 'en', // Default to English
};

// Bookmark types
export interface BookmarkItem {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  parentId?: string;
  index?: number;
}

export interface BookmarkFolder {
  id: string;
  title: string;
  children?: BookmarkNode[];
  dateAdded?: number;
  index?: number;
}

export type BookmarkNode = BookmarkItem | BookmarkFolder;

// Classification Result
export interface ClassificationResult {
  path: string;           // Target directory path, e.g., "Tech/Frontend"
  reason: string;         // Classification reason
}

// Page Content (from Tavily)
export interface PageContent {
  title: string;
  content: string;
  url: string;
}

// Progress Update
export interface ProgressUpdate {
  current: number;
  total: number;
  message: string;
  stage: 'idle' | 'backup' | 'sampling' | 'categorizing' | 'classifying' | 'complete';
}

// Message Types
export type MessageType =
  | 'GET_CONFIG'
  | 'SET_CONFIG'
  | 'START_INITIALIZATION'
  | 'STOP_INITIALIZATION'
  | 'GET_PROGRESS'
  | 'CLASSIFY_BOOKMARK'
  | 'EXPORT_BOOKMARKS';

export interface Message<T = any> {
  type: MessageType;
  payload?: T;
}
