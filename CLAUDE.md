# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Wizard of Oz experiment for testing proactive AI assistance in real-time writing. The system has two main interfaces:
- **User Interface**: A text editor where users write content and receive AI suggestions
- **Wizard Interface**: A control panel where human moderators can view, edit, and approve AI suggestions before they reach users

## Development Commands

```bash
# Development
pnpm dev           # Start development server
pnpm build         # Build for production  
pnpm start         # Start production server
pnpm lint          # Run ESLint

# Note: This project uses pnpm as the package manager
```

## Architecture

### Core Technologies
- **Next.js 15** with React 19 (App Router)
- **Supabase** for realtime database and synchronization
- **DeepSeek V3** for AI text generation
- **TypeScript** for type safety
- **Tailwind CSS** for styling

### Key Components

#### API Routes
- `/api/suggestion` - Generates text completion suggestions using DeepSeek
- `/api/comment-suggestion` - Generates reader feedback comments

#### Main Pages
- `/user` - Text editor interface for users
- `/wizard` - Control panel for moderators (supports `?mode=comment` parameter)

#### Core Components
- `HighlightTextEditor` - Text editor with highlight support
- `SuggestionPanel` - Displays and manages AI suggestions
- `SuggestionEditor` - Wizard interface for editing suggestions
- `DeepSeekSuggestion` - AI suggestion generation for append mode
- `DeepSeekFeedback` - AI comment generation for feedback mode

### Database Schema
Uses Supabase with tables:
- `users` - User accounts and sessions
- `documents` - User text content  
- `suggestions` - AI suggestions with type (append/comment), status, and reactions

### Realtime Features
- Document changes sync between user and wizard in real-time
- Suggestion delivery and status updates via Supabase Realtime
- Typing speed monitoring and CSV export

### AI Integration
- Text completion follows last sentence extraction logic (Chinese/English punctuation)
- Two suggestion types: "append" (补全) and "comment" (建议)
- System prompts defined in `lib/SystemPrompts.ts`

## Development Notes

### Environment Setup
Requires Supabase environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Data Flow
1. User types in text editor → updates `documents` table
2. Wizard generates suggestion → saves to `suggestions` table  
3. User receives suggestion via Realtime → can accept/reject/like
4. All interactions logged with typing speed metrics

### Wizard Modes
- **补全模式** (`/wizard`): For text completion (蓝色主题)
- **建议模式** (`/wizard?mode=comment`): For writing suggestions (红色主题)