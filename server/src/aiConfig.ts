import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./db.js";

// AI connection settings. Saved by the Settings dialog to data/ai.json (mode
// 0600, git-ignored); falls back to ANTHROPIC_API_KEY / ANTHROPIC_MODEL. The key
// never leaves this process: no route returns it.

const file = join(dataDir, "ai.json");

export type AiProvider = "anthropic" | "openai";
export type AiConfig = { provider: AiProvider; apiKey: string; model: string; baseUrl: string };

export const DEFAULT_MODEL: Record<AiProvider, string> = { anthropic: "claude-opus-4-8", openai: "gpt-4o" };
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function readFile(): Partial<AiConfig> {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

export function loadAiConfig(): AiConfig {
  const f = readFile();
  const provider: AiProvider = f.provider === "openai" ? "openai" : "anthropic";
  const apiKey = f.apiKey || (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY ?? "" : "");
  const model = f.model || (provider === "anthropic" ? process.env.ANTHROPIC_MODEL : undefined) || DEFAULT_MODEL[provider];
  return { provider, apiKey, model, baseUrl: f.baseUrl || DEFAULT_BASE_URL };
}

/** An OpenAI-compatible server on a custom base URL (Ollama, LM Studio…) needs no key. */
export function isConfigured(c: AiConfig): boolean {
  if (c.provider === "anthropic") return Boolean(c.apiKey);
  return Boolean(c.apiKey) || c.baseUrl.replace(/\/+$/, "") !== DEFAULT_BASE_URL;
}

export function saveAiConfig(patch: Partial<AiConfig>): AiConfig {
  const cur = readFile();
  const next: Partial<AiConfig> = { ...cur, ...patch };
  writeFileSync(file, JSON.stringify(next), { mode: 0o600 });
  return loadAiConfig();
}
