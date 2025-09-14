#!/usr/bin/env node

import "dotenv/config";
import { startServer } from "./server.js";
import { startBrowser } from "./browser.js";

const hostname = "127.0.0.1";
const port = 3001;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn(
    "No GEMINI_API_KEY found in environment variables. Please set it in a .env file or your environment.\nYou can get an API key from https://aistudio.google.com/apikey"
  );

  process.exit(1);
}

startServer(hostname, port, API_KEY);
startBrowser(hostname, port);
