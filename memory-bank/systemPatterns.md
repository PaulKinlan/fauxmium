# System Patterns

This document describes the system architecture, key technical decisions, design patterns, and component relationships for the Fauxmium project.

## Architecture Overview

The Fauxmium application is composed of three main components:

1.  **Browser Controller (`browser.js`)**: Launches and manages a Puppeteer instance of Chrome. It is responsible for intercepting all navigation and image requests.
2.  **Proxy Server (`server.js`)**: An HTTP server that receives the intercepted requests from the browser. It communicates with the Google Gemini AI to generate content.
3.  **Main Entry Point (`index.js`)**: Initializes the application, parses command-line arguments, and starts both the browser controller and the proxy server.

The general flow is as follows:

1. The user navigates to a URL in the Fauxmium browser.
2. The browser controller intercepts the request and redirects it to the local proxy server.
3. The proxy server generates a prompt based on the request URL and sends it to the Gemini AI.
4. The AI returns a stream of HTML or an image.
5. The proxy server streams the response back to the browser, which then renders the content.

## Key Technical Decisions

- **Puppeteer for Browser Control**: Puppeteer was chosen for its robust API and powerful request interception capabilities, which are central to the project's architecture.
- **Node.js for the Proxy Server**: A Node.js HTTP server provides a lightweight and efficient way to handle the intercepted requests and manage the communication with the AI service.
- **`@google/genai` for AI Interaction**: This library simplifies the process of authenticating and interacting with the Google Gemini API.

## Design Patterns

- **Proxy Pattern**: The local server acts as a proxy, intercepting requests intended for the web and providing a different response (in this case, AI-generated content).
- **Singleton Pattern**: The `browser.js` and `server.js` modules effectively act as singletons, with a single instance of the browser and server running for the duration of the application's lifecycle.
