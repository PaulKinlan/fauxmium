import { GoogleGenAI } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { apiKeyFor, providers } from "./models.js";
import { readSSE } from "./sse.js";

export const MAX_MEDIA_BYTES = 64 * 1024 * 1024;
const MAX_OUTPUT_TOKENS = 16384;

function inlineMedia(data, mimeType) {
  if (typeof data !== "string" || !data || data.length > Math.ceil(MAX_MEDIA_BYTES / 3) * 4) {
    throw new Error("Provider returned no media or media exceeded 64 MiB");
  }
  if (!["image/png", "image/jpeg", "image/webp", "image/avif", "video/mp4", "video/webm"].includes(mimeType)) {
    throw new Error("Provider returned an unsupported media type");
  }
  const body = Buffer.from(data, "base64");
  if (!body.length || body.length > MAX_MEDIA_BYTES) throw new Error("Invalid media size");
  return { body, mimeType };
}

export function createGenerators(models, { env = process.env, fetchImpl = fetch } = {}) {
  const keys = Object.fromEntries(Object.values(models).filter(Boolean).map(({ provider }) =>
    [provider, apiKeyFor(provider, env)]
  ));
  const google = keys.gemini ? new GoogleGenAI({
    apiKey: keys.gemini,
    httpOptions: { fetch: fetchImpl, retryOptions: { attempts: 1 } },
  }) : null;

  async function request(provider, path, body, signal) {
    const response = await fetchImpl(`${providers[provider].baseURL}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(provider === "anthropic"
          ? { "x-api-key": keys[provider], "anthropic-version": "2023-06-01" }
          : { Authorization: `Bearer ${keys[provider]}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(new Error(`${provider} API returned HTTP ${response.status}; check API key, model access and quota`), { status: response.status });
    }
    return response;
  }

  async function download(uri, provider, signal) {
    // Follow signed download redirects, but never forward credentials to a CDN.
    for (let redirects = 0; redirects < 4; redirects++) {
      const url = new URL(uri);
      const allowed = provider === "gemini"
        ? ["generativelanguage.googleapis.com", "storage.googleapis.com"].includes(url.hostname)
        : url.hostname === "vidgen.x.ai";
      if (url.protocol !== "https:" || !allowed || url.username || url.password || url.port) {
        throw new Error("Provider returned an unexpected media download URL");
      }
      const response = await fetchImpl(url, {
        headers: url.hostname === "generativelanguage.googleapis.com" ? { "x-goog-api-key": keys.gemini } : {},
        signal, redirect: "manual",
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("Missing media redirect URL");
        uri = new URL(location, url).href;
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error(`Media download failed (HTTP ${response.status})`);
      }
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > MAX_MEDIA_BYTES) throw new Error("Media exceeded 64 MiB");
        chunks.push(chunk);
      }
      if (!bytes) throw new Error("Provider returned empty video");
      return { body: Buffer.concat(chunks), mimeType: "video/mp4" };
    }
    throw new Error("Too many media download redirects");
  }

  async function* text(prompt, signal) {
    const { provider, id: model } = models.text;
    let completed = false;
    if (provider === "gemini") {
      const stream = await google.interactions.create({
        model, input: prompt, stream: true, store: false,
        generation_config: { max_output_tokens: MAX_OUTPUT_TOKENS },
      }, { signal, maxRetries: 0 });
      for await (const event of stream) {
        if (event.event_type === "error") throw new Error("Gemini generation failed");
        if (event.event_type === "step.delta" && event.delta?.type === "text") yield { text: event.delta.text };
        if (event.event_type === "interaction.completed") {
          if (event.interaction.status !== "completed") throw new Error("Gemini generation did not complete");
          completed = true;
          const usage = event.interaction.usage;
          yield { usageMetadata: { promptTokenCount: usage?.total_input_tokens, totalTokenCount: usage?.total_tokens } };
        }
      }
    } else {
      const responses = provider === "openai";
      const anthropic = provider === "anthropic";
      const path = responses ? "/responses" : anthropic ? "/messages" : "/chat/completions";
      const body = responses
        ? { model, input: prompt, stream: true, store: false, max_output_tokens: MAX_OUTPUT_TOKENS }
        : { model, messages: [{ role: "user", content: prompt }], stream: true, max_tokens: MAX_OUTPUT_TOKENS };
      const response = await request(provider, path, body, signal);
      let inputTokens;
      let outputTokens;
      for await (const event of readSSE(response)) {
        if (event.error || event.type === "error" || ["response.failed", "response.incomplete"].includes(event.type)) {
          throw new Error(`${provider} generation failed or was incomplete`);
        }
        let content;
        if (responses) {
          if (event.type === "response.output_text.delta") content = event.delta;
          if (event.type === "response.refusal.delta") throw new Error("OpenAI declined this generation");
          if (event.type === "response.completed") {
            completed = true;
            inputTokens = event.response?.usage?.input_tokens;
            outputTokens = event.response?.usage?.output_tokens;
          }
        } else if (anthropic) {
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") content = event.delta.text;
          if (event.type === "message_start") inputTokens = event.message?.usage?.input_tokens;
          if (event.type === "message_delta") {
            if (["max_tokens", "refusal"].includes(event.delta?.stop_reason)) throw new Error("Claude output was truncated or declined");
            outputTokens = event.usage?.output_tokens;
          }
          if (event.type === "message_stop") completed = true;
        } else {
          const choice = event.choices?.[0];
          content = choice?.delta?.content;
          if (["length", "content_filter"].includes(choice?.finish_reason)) throw new Error(`${provider} output was truncated or declined`);
          if (choice?.finish_reason === "stop") completed = true;
          inputTokens = event.usage?.prompt_tokens ?? inputTokens;
          outputTokens = event.usage?.completion_tokens ?? outputTokens;
        }
        if (content) yield { text: content };
      }
      if (inputTokens !== undefined && outputTokens !== undefined) {
        yield { usageMetadata: { promptTokenCount: inputTokens, totalTokenCount: inputTokens + outputTokens } };
      }
    }
    if (!completed) throw new Error(`${provider} stream ended before generation completed`);
  }

  async function image(prompt, signal) {
    const { provider, id: model } = models.image;
    if (provider === "gemini") {
      const result = await google.interactions.create({
        model, input: prompt, store: false, response_format: { type: "image" },
      }, { signal, maxRetries: 0 });
      return inlineMedia(result.output_image?.data, result.output_image?.mime_type);
    }
    const response = await request(provider, "/images/generations", {
      model, prompt, n: 1,
      ...(provider === "xai" ? { response_format: "b64_json" } : { output_format: "png" }),
    }, signal);
    const result = await response.json();
    if (result.data?.[0]?.respect_moderation === false) throw new Error("Image generation was declined");
    return inlineMedia(result.data?.[0]?.b64_json, provider === "xai" ? "image/jpeg" : "image/png");
  }

  async function video(prompt, signal) {
    const { provider, id: model } = models.video;
    if (provider === "gemini") {
      if (!model.startsWith("veo-")) {
        const result = await google.interactions.create({
          model, input: prompt, store: false, response_format: { type: "video" },
        }, { signal, maxRetries: 0 });
        return inlineMedia(result.output_video?.data, result.output_video?.mime_type);
      }
      let operation = await google.models.generateVideos({
        model, source: { prompt }, config: { numberOfVideos: 1, abortSignal: signal },
      });
      while (!operation.done) {
        await delay(10000, undefined, { signal });
        operation = await google.operations.getVideosOperation({ operation, config: { abortSignal: signal } });
      }
      if (operation.error) throw new Error("Veo video generation failed");
      const result = operation.response?.generatedVideos?.[0]?.video;
      if (result?.videoBytes) return inlineMedia(result.videoBytes, result.mimeType || "video/mp4");
      if (!result?.uri) throw new Error("Veo returned no video (it may have been filtered)");
      return download(result.uri, provider, signal);
    }
    const response = await request(provider, "/videos/generations", { model, prompt, duration: 5 }, signal);
    const { request_id } = await response.json();
    if (!request_id) throw new Error("xAI returned no video job ID");
    for (;;) {
      const status = await request(provider, `/videos/${encodeURIComponent(request_id)}`, null, signal);
      const result = await status.json();
      if (result.status === "done" && result.video?.url && result.video.respect_moderation !== false) {
        return download(result.video.url, provider, signal);
      }
      if (result.status !== "pending") throw new Error("xAI video generation failed, expired or was filtered");
      await delay(5000, undefined, { signal });
    }
  }

  return { text, image, video };
}
