## The Infinite Generated Web

**Everything that you see inside the browser when you use this demo is generated on the fly. It is not real!**

**This demo is not affiliated with my employer or any of its products.**

This demo is a proof of concept that shows how you can use generative AI to create an infinite number of websites as you browse. It uses Chrome for Testers and [Puppeteer](https://pptr.dev/) to intercept every single request that is made from the page and route it to Gemini, and the response is used to generate the content on the page.

## How to run

`npx fauxmium`

### Setup

This project requires a Google Gemini API Key.

1.  Create a `.env` file in the root of the project.
2.  Add your API key to the `.env` file:

    ```
    API_KEY=your_api_key_here
    ```

### Command-line options

- `--port` or `-p`: The port to run the server on. Defaults to `3001`.
- `--hostname` or `-H`: The hostname to run the server on. Defaults to `127.0.0.1`.
- `--text-generation-model` or `-t`: The model to use for text generation. Defaults to `gemini-2.5-flash-lite`.
- `--image-generation-model` or `-i`: The model to use for image generation. Defaults to `gemini-2.5-flash-image-preview`.

### Examples

Run on a different port with a specific model:

```bash
npx fauxmium --port 8080 --text-generation-model gemini-pro
```

## Architecture

This project works by intercepting browser requests and generating content using a generative AI model. Here's a breakdown of the process:

1.  **Browser Initialization**: The application starts by launching a Chrome instance using Puppeteer (`index.js`).
2.  **Request Interception**: Puppeteer is configured to intercept all navigation and image requests made by the browser.
3.  **Proxy Server**: Instead of fulfilling the requests from the web, the browser is redirected to a local proxy server (`server.js`).
4.  **AI Content Generation**: The proxy server receives the request and uses the `@google/genai` library to communicate with the Gemini AI model.
    - For page navigations, it generates a prompt based on the URL and streams the resulting HTML back to the browser.
    - For image requests, it generates a prompt and returns an AI-generated image.
5.  **Simulated Browsing**: The browser renders the AI-generated content, creating a simulated experience of browsing a fictitious web.

## Limitations

- **No CSS or JavaScript**: The current version only generates HTML and images. It does not support generating external CSS or JavaScript files for example.
- **Stateless**: Each page is generated independently. There is no memory or state between navigations, this also includes image generation which currently has not context of where it is placed on the page.

## Contributing

Contributions are welcome! If you have ideas for new features, improvements, or bug fixes, please open an issue or submit a pull request.

## License

This project is licensed under the Apache-2.0 License. See the `LICENCE` file for details.
