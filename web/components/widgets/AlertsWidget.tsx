"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiGet, apiPost, fmt, type Quote } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { normalizeSymbol, symbolsParam } from "../../lib/symbol";
import { isTriggered, useAlerts } from "../../store/alerts";
import { useTerminal } from "../../store/terminal";

type TgStatus = { configured: boolean; linked: boolean };

function TelegramSetup() {
  const t = useT();
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const { data: status } = useQuery({ queryKey: ["tg-status"], queryFn: () => apiGet<TgStatus>("/api/telegram/status") });
  const connect = useMutation({
    mutationFn: () => apiPost<TgStatus & { bot: string }>("/api/telegram/config", { token }),
    onSuccess: () => {
      setToken("");
      qc.invalidateQueries({ queryKey: ["tg-status"] });
    },
  });
  const test = useMutation({
    mutationFn: () => apiPost("/api/telegram/send", { text: "OpenTerminal ✅ " + t("Telegram alerts are connected.") }),
  });

  return (
    <div className="p-2 border-b border-[var(--border)] space-y-1">
      <div className={status?.linked ? "up" : "dim"}>
        {status?.linked ? "● " + t("Telegram connected") : status?.configured ? "○ " + t("Bot saved — send it /start, then press Connect") : "○ " + t("Telegram not connected")}
      </div>
      <ol className="dim text-[10px] list-decimal ps-4">
        <li>{t("In Telegram, open @BotFather and create a bot with /newbot")}</li>
        <li>{t("Paste the bot token below")}</li>
        <li>{t("Open your new bot and press Start (send /start)")}</li>
        <li>{t("Press Connect — the chat is detected automatically")}</li>
      </ol>
      <div className="flex gap-1 items-center flex-wrap">
        <input
          type="password"
          dir="ltr"
          autoComplete="off"
          className="flex-1 min-w-32"
          placeholder={status?.configured ? t("Token saved (paste a new one to replace)") : t("Bot token")}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button className="term-btn" disabled={connect.isPending || (!token && !status?.configured)} onClick={() => connect.mutate()}>
          {t("Connect")}
        </button>
        {status?.linked && (
          <button className="term-btn" disabled={test.isPending} onClick={() => test.mutate()}>
            {t("Send test")}
          </button>
        )}
      </div>
      {connect.error && <div className="down">{(connect.error as Error).message}</div>}
      {connect.data && !connect.data.linked && <div className="amber">{t("Bot found, but no chat yet — open it in Telegram, press Start, then Connect again.")}</div>}
      {test.error && <div className="down">{(test.error as Error).message}</div>}
      {test.isSuccess && <div className="up">{t("Test message sent.")}</div>}
    </div>
  );
}

// Alerts are evaluated here, so they only fire while this widget is open.
export default function AlertsWidget() {
  const t = useT();
  const [showTg, setShowTg] = useState(false);
  const [viaTelegram, setViaTelegram] = useState(false);
  const { data: tgStatus } = useQuery({ queryKey: ["tg-status"], queryFn: () => apiGet<TgStatus>("/api/telegram/status") });
  const activeSymbol = useTerminal((s) => s.activeSymbol);
  const { alerts, addAlert, removeAlert, markTriggered, rearm } = useAlerts();
  const [symbol, setSymbol] = useState("");
  const [op, setOp] = useState<">=" | "<=">(">=");
  const [price, setPrice] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [permission, setPermission] = useState<string>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const armed = alerts.filter((a) => a.triggeredAt === null);
  const symbols = [...new Set(alerts.map((a) => a.symbol))];

  const { data: quotes = [] } = useQuery({
    queryKey: ["alert-quotes", symbols.join(",")],
    queryFn: () => apiGet<Quote[]>(`/api/quotes?symbols=${symbolsParam(symbols)}`),
    enabled: symbols.length > 0,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    for (const a of armed) {
      const last = quotes.find((q) => q.symbol === a.symbol)?.price;
      if (last == null || !isTriggered(a.op, a.price, last)) continue;
      markTriggered(a.id, last);
      if (a.telegram) {
        apiPost("/api/telegram/send", {
          text: `🔔 ${a.symbol} ${a.op === ">=" ? "≥" : "≤"} ${fmt(a.price)} — ${fmt(last)}`,
        }).catch(() => {});
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`${a.symbol} ${a.op === ">=" ? "≥" : "≤"} ${fmt(a.price)}`, {
          body: `${a.symbol}: ${fmt(last)}`,
        });
      }
    }
  }, [quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const sym = normalizeSymbol(symbol || activeSymbol);
    const target = Number(price);
    if (!sym || !isFinite(target) || target <= 0) {
      setInvalid(true);
      return;
    }
    addAlert(sym, op, target, viaTelegram && !!tgStatus?.linked);
    setPrice("");
    setInvalid(false);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(setPermission);
    }
  };

  return (
    <div>
      <form
        className="flex gap-1 p-1 border-b border-[var(--border)] flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="w-20"
          placeholder={activeSymbol}
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        />
        <select value={op} onChange={(e) => setOp(e.target.value as ">=" | "<=")}>
          <option value=">=">{t("Above")} ≥</option>
          <option value="<=">{t("Below")} ≤</option>
        </select>
        <input
          className={`w-24 ${invalid ? "!border-[var(--down)]" : ""}`}
          placeholder={t("Price")}
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            setInvalid(false);
          }}
        />
        <label className="flex items-center gap-1 dim" title={tgStatus?.linked ? undefined : t("Connect Telegram first")}>
          <input
            type="checkbox"
            disabled={!tgStatus?.linked}
            checked={viaTelegram && !!tgStatus?.linked}
            onChange={(e) => setViaTelegram(e.target.checked)}
          />
          Telegram
        </label>
        <button className="term-btn" type="submit">{t("ADD")}</button>
        <button className={`term-btn ${showTg ? "active" : ""}`} type="button" onClick={() => setShowTg(!showTg)}>
          ✈ {t("SETUP")}
        </button>
      </form>
      {showTg && <TelegramSetup />}
      {permission === "denied" && <div className="px-2 py-1 dim">{t("Browser notifications are blocked; alerts show here only.")}</div>}
      <table className="data-table">
        <thead>
          <tr><th>{t("Sym")}</th><th>{t("Condition")}</th><th>{t("Last")}</th><th>{t("Status")}</th><th></th></tr>
        </thead>
        <tbody>
          {alerts.map((a) => {
            const last = quotes.find((q) => q.symbol === a.symbol)?.price;
            return (
              <tr key={a.id}>
                <td className="font-bold">{a.symbol}{a.telegram ? " ✈" : ""}</td>
                <td>{a.op === ">=" ? "≥" : "≤"} {fmt(a.price)}</td>
                <td>{fmt(last)}</td>
                <td className={a.triggeredAt ? "up" : "dim"}>
                  {a.triggeredAt ? (
                    <button className="underline" title={t("Re-arm")} onClick={() => rearm(a.id)}>
                      ✔ {fmt(a.triggeredPrice)}
                    </button>
                  ) : (
                    t("Armed")
                  )}
                </td>
                <td>
                  <button className="dim hover:text-[var(--down)]" onClick={() => removeAlert(a.id)}>✕</button>
                </td>
              </tr>
            );
          })}
          {alerts.length === 0 && (
            <tr><td colSpan={5} className="dim p-3">{t("No price alerts yet.")}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
