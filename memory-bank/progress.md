# Project Progress

This document tracks what works, what's left to build, the current status, known issues, and the evolution of project decisions.

## What Works

- The application successfully launches a Puppeteer-controlled Chrome browser.
- Request interception for navigation and image requests is functional.
- The local proxy server correctly receives intercepted requests.
- The server can communicate with the Google Gemini API to generate HTML and images.
- The generated content is successfully rendered in the browser.
- The application is configurable via command-line arguments.
- A Chrome extension is available to track session costs.

## What's Left to Build

- **CSS and JavaScript Generation**: The application currently only generates HTML and images. Support for generating CSS and JavaScript is a major feature to be added.
- **State Management**: There is no state management between page navigations, making each page generation an independent event.
- **Improved Image Generation**: The image generation process needs to be improved to be more context-aware.

## Known Issues

- The application is stateless, which can lead to a disjointed browsing experience.
- The lack of CSS and JavaScript results in visually simple pages with lower interactivity.
- Image generation can be slow and may not always produce relevant images because of the lack of context.
- Error handling for network issues and API failures is minimal.
