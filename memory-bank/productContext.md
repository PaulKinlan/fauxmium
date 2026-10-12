# Product Context: Fauxmium

This document explains why Fauxmium exists, the problems it solves, and how it delivers a cohesive user experience.

## Why Fauxmium Exists
- **From Passive Retrieval to Generative Exploration**: The traditional web is fixed and bounded. Fauxmium reimagines the browser as an active generative engine where typing an address or clicking a hyperlink constructs a plausible, beautifully styled, interactive reality tailored to user navigation and aesthetic preferences.
- **Overcoming LLM Web Synthesis "Amnesia"**: Naive web synthesis generates disjointed single pages with inconsistent styles, broken links, and forgotten context. Fauxmium solves this with site-level design DNA extraction, `a => b` link context capturing, persistent per-domain session state (e.g. login credentials, search queries, cart items), and multi-turn navigation threading.
- **Aesthetic Time-Travel via Browsing Lenses**: Allows developers, designers, and web enthusiasts to experience the web through historical eras (90s GeoCities, Y2K bubblegum, 80s Arcade) or stylized artistic visions (Cyberpunk 2077, Film Noir, Neobrutalism) without altering underlying website semantics.

## User Experience Workflows
1. **Launch & Navigation**:
   - The user starts Fauxmium via `npx fauxmium` or `npm start`. A Chromium browser opens displaying a stylish warning screen making it clear that all subsequent content is synthetic.
   - The user types any URL (e.g. `wikipedia.org/wiki/Quantum_Computing`, `paul.kinlan.me/projects`, `shop.hyperloop.com/tickets`) or submits forms.
2. **Cohesive Multi-Modal Page Rendering**:
   - The page streams into view with top progress indicator and image skeleton animations.
   - Text, layouts, and interactive client-side JavaScript elements (tabs, menus, calculators, clocks) are fully functional.
   - Media elements (`<img>`, `<video>`, `<audio>`) load asynchronously with high-contrast, contextually matched assets, while video supports seamless seeking via HTTP 206 byte-range responses.
3. **Link-Level Narrative Progression**:
   - Clicking an article card, product item, or video link passes the clicked item's title, snippet, and `data-context` to the target page, ensuring the target page is about the exact item clicked.
4. **Extension Control & Live Accounting**:
   - The toolbar extension popup shows real-time cost breakdowns across Text, Image, Video, and Audio.
   - Users can switch the active Browsing Lens directly from the popup and hit "↻ Regenerate Tab" to immediately view the same page in the new aesthetic.
