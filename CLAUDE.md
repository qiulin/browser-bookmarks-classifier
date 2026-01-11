# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome/Edge browser extension for automatically classifying bookmarks using LLM APIs. Written in TypeScript with React UI components.

## Development Commands

```bash
# Development (with hot reload)
npm run dev

# Production build (type check + vite build)
npm run build

# Preview built extension
npm run preview
```

The build outputs to `dist/` directory. Load the unpacked extension in Chrome/Edge from this folder.

## Architecture

### Entry Points (Multi-Build)

The extension has three entry points defined in `vite.config.ts`:
- **background**: `src/background/index.ts` - Service worker for background processing
- **popup**: `popup.html` → `src/popup.tsx` - Extension popup UI
- **options**: `options.html` → `src/options.tsx` - Full settings/options page

Vite copies `public/manifest.json` to `dist/` after build.

### Service Layer (Singleton Pattern)

All services in `src/services/` are exported as singletons:

- **classifierService** (`classifier.ts`) - Core classification logic
  - Manages initialization mode (batch re-classification)
  - Handles abort/cancellation via AbortController
  - Implements concurrency control for batch processing
  - Creates category folders and moves bookmarks

- **scraperService** (`scraperService.ts`) - Unified content scraping interface
  - Provider-agnostic (Tavily, Jina Reader, Metaso AI)
  - Configurable via `scraperProvider` setting

- **openaiService** (`openaiService.ts`) - LLM API client
  - Compatible with OpenAI and other LLM providers
  - Handles category creation and bookmark classification
  - Supports configurable base URL, API key, and model

- **bookmarkService** (`bookmarkService.ts`) - Chrome Bookmarks API wrapper
  - Tree traversal and folder operations
  - Archive creation and bookmark movement
  - Multi-level folder path creation

- **storageService** (`storage.ts`) - Chrome Storage API wrapper
  - Manages configuration and progress state
  - Storage keys: `bookmark_classifier_config`, `bookmark_classifier_progress`

- **rulesService** (`rulesService.ts`) - Custom classification rules
  - Markdown-based rule parsing
  - Pre-AI classification pattern matching

### Background Service Worker

`src/background/index.ts` coordinates the extension:

1. Listens for `runtime.onStartup` and `runtime.onInstalled` to initialize services
2. Handles message passing from popup/options pages via `runtime.onMessage`
3. Monitors TODO folder at configurable intervals (default 1 minute)
4. Maintains heartbeat (every 20s) to prevent service worker suspension

**Message types**: `GET_CONFIG`, `SET_CONFIG`, `START_INITIALIZATION`, `STOP_INITIALIZATION`, `GET_PROGRESS`, `CLASSIFY_BOOKMARK`, `EXPORT_BOOKMARKS`

### Operational Modes

**Initialization Mode** (via `START_INITIALIZATION`):
1. Create Archive folder with original bookmarks
2. Sample configurable percentage (default 20%) of bookmarks
3. Fetch content for samples via scraper API
4. Create categories (AI-generated or predefined)
5. Classify all bookmarks into categories with concurrency control
6. Clean up empty folders, create TODO folder

**Incremental Mode** (automatic):
- Checks TODO folder at `checkInterval` (default 60000ms)
- Processes new bookmarks not in `processedBookmarkIds` Set
- Moves classified bookmarks to appropriate categories

### React UI Structure

- **popup.tsx** - Quick access to initialization and configuration
- **options.tsx** - Tabbed container (Configuration + Initialization tabs)
- **components/Config/ConfigPage.tsx** - Full configuration form
- **components/Initialization/InitPage.tsx** - Multi-stage initialization UI with progress tracking
- **hooks/useStorage.ts** - React hook for Chrome Storage state synchronization

### Configuration Schema

Defined in `src/types/index.ts`:

```typescript
interface ExtensionConfig {
  // LLM Configuration
  openaiBaseUrl: string;
  openaiApiKey: string;
  llmModel: string;  // default 'gpt-4o-mini'

  // Scraper Configuration
  scraperProvider: 'tavily' | 'jina' | 'metaso';
  tavilyApiKey: string;
  jinaReaderApiKey: string;
  metasoReaderApiKey: string;

  // Classification Settings
  initSampleRate: number;          // default 0.2 (20%)
  maxCategories: number;           // default 10
  maxDirectoryDepth: number;       // default 2
  classificationConcurrency: number; // default 10
  customRules: string;             // Markdown format
  predefinedCategories: string;    // One per line
  excludedDirs: string[];

  // State
  isInitialized: boolean;
  isProcessing: boolean;

  // TODO Folder
  todoFolderName: string;          // default "TODO"
  checkInterval: number;           // default 60000ms

  // Language
  defaultLanguage: string;         // default 'en'
}
```

### Special Folder Names

- **Archive** - Original bookmark backup (created during initialization)
- **Failures** - Bookmarks that failed classification
- **TODO** - Folder monitored for incremental classification

### TypeScript Configuration

- Target: ES2020
- Chrome extension types via `@types/chrome`
- Strict mode enabled
- JSX: react-jsx (automatic runtime)

### Testing Notes

- No test framework is currently configured
- Services export singleton instances for easier testing
- Background service exports `initializeServices` and `handleMessage` for testing
