# Chrome Bookmarks Classifier

A Chrome/Edge browser extension that automatically classifies bookmarks using LLM APIs.

## Features

- **Initialization Mode**: Re-classify all existing bookmarks
  - Creates backup archive of original bookmarks
  - Samples and analyzes bookmark content
  - Generates category structure using AI
  - Classifies all bookmarks into appropriate folders

- **Incremental Mode**: Automatic TODO folder monitoring
  - Add bookmarks to "TODO" folder
  - Automatically classifies and moves them to appropriate categories
  - Configurable check interval (default: 1 minute)

- **Multiple LLM Support**: Compatible with OpenAI and other OpenAI-compatible APIs
  - OpenAI (GPT-4o Mini, etc.)
  - Claude
  - DeepSeek
  - Other compatible providers

- **Multiple Scraper Options**: Fetch page content from various sources
  - Tavily API
  - Jina Reader API
  - Metaso AI Reader

- **Custom Rules**: Define your own classification rules in markdown format
  - Pattern matching for URLs, titles, domains
  - Pre-AI classification for predictable results

- **Predefined Categories**: Optionally provide your own category structure

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd chrome-bookmarks-classifier
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome/Edge:
   - Open `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

## Configuration

### Required API Keys

The extension requires API keys for:

1. **LLM API** (for classification)
   - OpenAI API key or compatible provider
   - Configure base URL if using a non-OpenAI provider

2. **Scraper API** (for fetching page content)
   - Tavily API key (recommended)
   - Or Jina Reader API key
   - Or Metaso AI Reader API key

### Configuration Options

Access the extension options page:
- Click the extension icon → "Open Settings"
- Or go to `chrome://extensions/` → "Details" → "Extension options"

**Settings include:**
- LLM model selection (default: GPT-4o Mini)
- Scraper provider selection
- Sample rate for initialization (default: 20%)
- Maximum categories (default: 10)
- Directory depth (default: 2 levels)
- Classification concurrency (default: 10)
- TODO folder name and check interval
- Custom classification rules
- Predefined categories
- Excluded directories

## Usage

### Initialization Mode

1. Open the extension popup or options page
2. Go to the "Initialization" tab
3. Optionally export your current bookmarks as backup
4. Click "Start Initialization"
5. Wait for the process to complete (progress will be shown)

The initialization process will:
- Create an "Archive" folder with all original bookmarks
- Sample a percentage of bookmarks for category creation
- Generate or use predefined categories
- Classify all bookmarks
- Create a "TODO" folder for new bookmarks

### Incremental Mode

After initialization:
1. Simply add new bookmarks to the "TODO" folder
2. The extension will automatically check and classify them
3. Classified bookmarks will be moved to appropriate categories

### Custom Rules

Define custom classification rules in markdown format:

```markdown
## Tech Blogs

- url: blog.cloudflare.com
- url: engineering.fb.com

## Frontend Frameworks

- title: React
- title: Vue
- title: Angular

## Developer Tools

- domain: github.com
- domain: stackoverflow.com
```

Rules are checked before AI classification, allowing you to handle specific cases manually.

## Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Preview built extension
npm run preview
```

### Project Structure

```
chrome-bookmarks-classifier/
├── src/
│   ├── background/          # Service worker
│   ├── components/          # React UI components
│   ├── services/            # Core business logic
│   ├── hooks/              # React hooks
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── public/
│   └── manifest.json       # Extension manifest
├── dist/                   # Built extension (load this in browser)
└── vite.config.ts         # Build configuration
```

## API Keys Setup

### OpenAI

1. Get API key from https://platform.openai.com/api-keys
2. Enter in extension settings:
   - API Base URL: `https://api.openai.com/v1`
   - API Key: your key
   - Model: `gpt-4o-mini` (recommended)

### Tavily

1. Get API key from https://tavily.com
2. Enter in extension settings

### Jina Reader

1. Get API key from https://jina.ai/reader
2. Select "jina" as scraper provider
3. Enter API key in extension settings

### Metaso AI Reader

1. Get Metaso account
2. Select "metaso" as scraper provider
3. Enter API key in extension settings

## Troubleshooting

- **Bookmarks not being classified**: Check that API keys are correctly configured
- **"TODO folder not found"**: Run initialization first to create the TODO folder
- **Service worker suspended**: The extension uses a heartbeat to stay active
- **Failed classifications**: Check the "Failures" folder for problematic bookmarks

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
