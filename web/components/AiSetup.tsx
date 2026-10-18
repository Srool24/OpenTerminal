"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { useT } from "../lib/i18n";

type AiStatus = { provider: "anthropic" | "openai"; model: string; baseUrl: string; hasKey: boolean; configured: boolean };

const MODEL_HINT = { anthropic: "claude-opus-4-8", openai: "gpt-4o" };

export default function AiSetup() {
  const t = useT();
  const qc = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["ai-config"], queryFn: () => apiGet<AiStatus>("/api/ai/config") });
  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    if (!status) return;
    setProvider(status.provider);
    setModel(status.model);
    setBaseUrl(status.baseUrl);
  }, [status]);

  const save = useMutation({
    mutationFn: () => apiPost<AiStatus>("/api/ai/config", { provider, apiKey, model, ...(provider === "openai" ? { baseUrl } : {}) }),
    onSuccess: () => {
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["ai-config"] });
      qc.invalidateQueries({ queryKey: ["status"] });
    },
  });
  const test = useMutation({ mutationFn: () => apiPost("/api/ai/test", {}) });

  return (
    <div className="space-y-1">
      <div className={status?.configured ? "up" : "dim"}>
        {status?.configured ? "● " + t("AI connected") + ` — ${status.model}` : "○ " + t("AI not connected")}
      </div>
      <div className="flex gap-1">
        <button className={`term-btn ${provider === "anthropic" ? "active" : ""}`} onClick={() => { setProvider("anthropic"); setModel(MODEL_HINT.anthropic); }}>
          Anthropic (Claude)
        </button>
        <button className={`term-btn ${provider === "openai" ? "active" : ""}`} onClick={() => { setProvider("openai"); setModel(MODEL_HINT.openai); }}>
          OpenAI / {t("compatible")}
        </button>
      </div>
      {provider === "openai" && (
        <>
          <input dir="ltr" className="w-full" placeholder="https://api.openai.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          <div className="dim text-[10px]">{t("Works with OpenAI, OpenRouter, Ollama, LM Studio and any OpenAI-compatible server.")}</div>
        </>
      )}
      <input dir="ltr" className="w-full" placeholder={t("Model")} value={model} onChange={(e) => setModel(e.target.value)} />
      <input
        type="password"
        dir="ltr"
        autoComplete="off"
        className="w-full"
        placeholder={status?.hasKey ? t("Key saved (paste a new one to replace)") : t("API key")}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <div className="flex gap-1">
        <button className="term-btn" disabled={save.isPending} onClick={() => save.mutate()}>{t("Save")}</button>
        <button className="term-btn" disabled={test.isPending || !status?.configured} onClick={() => test.mutate()}>{t("Test connection")}</button>
      </div>
      {save.error && <div className="down">{(save.error as Error).message}</div>}
      {save.isSuccess && !save.error && <div className="up">{t("Saved.")}</div>}
      {test.error && <div className="down">{(test.error as Error).message}</div>}
      {test.isSuccess && <div className="up">{t("Connection works.")}</div>}
    </div>
  );
}
