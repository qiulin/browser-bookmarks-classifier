# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome/Edge browser extension for automatically classifying bookmarks using LLM APIs. The project is written in TypeScript and is currently in early development stage.

## Key Features

The extension supports two operational modes:

1. **Initialization Mode**: Re-classifies all existing browser bookmarks
   - Requires user confirmation with option to export existing bookmarks first
   - Preserves original bookmarks in an Archive directory
   - Supports configurable directory exclusions
   - Samples and fetches a percentage (e.g., 20%) of bookmark pages via Tavily API
   - Creates new category directories (max count configurable, default 10)
   - Classifies each bookmark into appropriate directories

2. **Incremental Mode**: Monitors the "TODO" bookmark folder
   - Automatically classifies new bookmarks added to the TODO folder
   - Moves classified bookmarks to appropriate category directories

## External APIs

- **OpenAI-compatible API**: For bookmark classification (configured via extension settings)
  - `OPENAI_BASE_URL`: API endpoint
  - `OPENAI_API_KEY`: Authentication key

- **Tavily API**: For fetching/scraping bookmark page content
  - `TAVILY_API_KEY`: Configured via extension settings

## Classification Process

For each bookmark:
1. Call Tavily API to scrape the original page content
2. Call OpenAI-compatible API to classify the content
3. Move bookmark to the appropriate existing category directory

## Project Status

This is a greenfield project. The source code structure has not yet been established.
