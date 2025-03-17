# Proactive AI Wizard of Oz

This project is a Wizard of Oz experiment designed to test proactive AI assistance in real-time writing. The MVP allows a human "wizard" to view and modify AI-generated suggestions before they are pushed to the user, and collects detailed data for analysis.

## Overview

- **User Interface:** A web-based text editor where users can create content and receive proactive AI suggestions.
- **Wizard Interface:** A control panel that displays the current text context, AI-generated suggestions, and allows a human moderator (wizard) to edit or override these suggestions before they reach the user.
- **Realtime Data & Logging:** Uses Supabase Realtime to sync events between the user and wizard, capturing logs of text changes, suggestion events, and user decisions.

## Features

- **Real-time Collaboration:** Built with Next.js and Supabase Realtime for a seamless, low-latency experience.
- **Wizard Control:** A dedicated dashboard for monitoring user activity and managing AI suggestions.
- **Event Logging:** Detailed logging of:
  - User text input snapshots
  - AI suggestions generated
  - Wizard modifications
  - User decisions (accept, partially accept, reject)
- **Data Collection for Analysis:** Exportable logs (CSV/Excel) and screen recording (to be integrated with external tools) for later analysis.

## Architecture

### User Side
- **Text Editor:** A simple UI for content creation.
- **Suggestion Display:** A sidebar or inline suggestion box that shows AI suggestions pushed by the wizard.

### Wizard Side
- **Control Panel:** Displays the user's current text state and pending AI suggestions.
- **Editable Suggestion Field:** Allows modifications to suggestions before they are sent to the user.
- **Send Button:** Pushes the final suggestion to the user interface.

### Backend
- **Supabase Realtime:** For synchronizing events and data between user and wizard interfaces.
- **API Endpoints:**
  - `/api/userState`: To fetch the current text state.
  - `/api/pushSuggestion`: To send a suggestion from the wizard to the user.
  - `/api/logEvent`: To record every interaction event.

## Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/proactive-ai-wizard-of-oz.git
   cd proactive-ai-wizard-of-oz