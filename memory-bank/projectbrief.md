# Project Brief

This document outlines the core requirements and goals of the Fauxmium project. It serves as the source of truth for the project's scope.

## Project Goals

- To create a web browser that generates a fictitious web on the fly using generative AI.
- To provide a proof-of-concept demonstrating the capabilities of generative AI in creating dynamic and infinite web content.
- To build a system that intercepts browser requests and uses them to generate relevant HTML and image content.

## Core Requirements

- The application uses Puppeteer to control a disposable Chrome browser, headed for interactive use and headless for tests.
- All navigation and image requests from the browser must be intercepted.
- A private local proxy handles intercepted requests and generates content using independently selected AI providers.
- The application must be configurable via command-line arguments (e.g., port, hostname, AI models).
- The system generates HTML and images, with explicit opt-in video generation. Content must remain clearly identified as fictitious.
