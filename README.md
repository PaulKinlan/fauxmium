## The Infinite Generated Web

** Everything that you see inside the browser when you use this demo is generated on the fly. It is not real! **

When websim.ai was created it was designed to be a browser inside a browser. You could type in a URL and it would generate a website for you... I thought it would be neat that instead of being a webpage it was a actual real browser window.

This demo is a proof of concept that shows how you can use generative AI to create an infinite number of websites as you browse. It uses Chrome for Testers and Puppeteer with Chrome DevTools Protocol to intercept every single request that is made from the page and route it to either Gemini 2.5 Flash-lite or Nano Banana, and the response is used to generate the content on the page.
