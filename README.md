## The Infinite Generated Web

**Everything that you see inside the browser when you use this demo is generated on the fly. It is not real!**

**This demo is not affiliated with my employer or any of its products.**

This demo is a proof of concept that shows how you can use generative AI to create an infinite number of websites as you browse. It uses Chrome for Testers and [Puppeteer](https://pptr.dev/) to intercept every single request that is made from the page and route it to Gemini, and the response is used to generate the content on the page.

## How to run

`npx fauxmium`

### Command-line options

- `--port` or `-p`: The port to run the server on. Defaults to `3001`.
- `--hostname` or `-H`: The hostname to run the server on. Defaults to `127.0.0.1`.
- `--text-generation-model` or `-t`: The model to use for text generation. Defaults to `gemini-2.5-flash-lite`.
- `--image-generation-model` or `-i`: The model to use for image generation. Defaults to `gemini-2.5-flash-image-preview`.

## Architecture

This project works by intercepting browser requests and generating content using a generative AI model. Here's a breakdown of the process:

1.  **Browser Initialization**: The application starts by launching a Chrome instance using Puppeteer (`index.js`).
2.  **Request Interception**: Puppeteer is configured to intercept all navigation and image requests made by the browser.
3.  **Proxy Server**: Instead of fulfilling the requests from the web, the browser is redirected to a local proxy server (`server.js`).
4.  **AI Content Generation**: The proxy server receives the request and uses the `@google/genai` library to communicate with the Gemini AI model.
    - For page navigations, it generates a prompt based on the URL and streams the resulting HTML back to the browser.
    - For image requests, it generates a prompt and returns an AI-generated image.
5.  **Simulated Browsing**: The browser renders the AI-generated content, creating a simulated experience of browsing a fictitious web.
