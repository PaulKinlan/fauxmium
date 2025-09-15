# Technical Context

This document outlines the technologies used, development setup, technical constraints, and dependencies for the Fauxmium project.

## Technologies

- **Node.js**: The runtime environment for the application.
- **Puppeteer**: Used to control a headless instance of Chrome and intercept network requests.
- **`@google/genai`**: The official Google library for interacting with the Gemini AI models.
- **`yargs`**: A library for parsing command-line arguments.
- **`dotenv`**: Used to manage environment variables, specifically the `GEMINI_API_KEY`.

## Development Setup

1.  **Install Dependencies**: Run `npm install` to install the required packages.
2.  **Set API Key**: Create a `.env` file in the root of the project and add your Google Gemini API key as `GEMINI_API_KEY=your_api_key_here`.
3.  **Run the Application**: Execute `npx fauxmium` in the terminal. The application can be configured with command-line options for port, hostname, and AI models.

## Technical Constraints

- **No CSS or JavaScript Generation**: The current implementation only generates HTML and images. It does not support the generation of external CSS or JavaScript files.
- **Stateless Navigations**: Each page is generated independently. There is no memory or state preserved between navigations.
- **Image Generation Context**: The image generation process currently lacks the context of where the image will be placed on the page.
