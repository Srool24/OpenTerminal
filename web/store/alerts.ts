"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PriceAlert = {
  id: string;
  symbol: string;
  op: ">=" | "<=";
  price: number;
  /** Also send a Telegram message when it fires. */
  telegram: boolean;
  /** Set (ms epoch) once the condition was met; a triggered alert never fires again. */
  triggeredAt: number | null;
  triggeredPrice: number | null;
};

type AlertsState = {
  alerts: PriceAlert[];
  addAlert: (symbol: string, op: PriceAlert["op"], price: number, telegram: boolean) => void;
  removeAlert: (id: string) => void;
  markTriggered: (id: string, price: number) => void;
  rearm: (id: string) => void;
};

export const useAlerts = create<AlertsState>()(
  persist(
    (set) => ({
      alerts: [],
      addAlert: (symbol, op, price, telegram) =>
        set((st) => ({
          alerts: [
            ...st.alerts,
            { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, symbol, op, price, telegram, triggeredAt: null, triggeredPrice: null },
          ],
        })),
      removeAlert: (id) => set((st) => ({ alerts: st.alerts.filter((a) => a.id !== id) })),
      markTriggered: (id, price) =>
        set((st) => ({
          alerts: st.alerts.map((a) => (a.id === id ? { ...a, triggeredAt: Date.now(), triggeredPrice: price } : a)),
        })),
      rearm: (id) =>
        set((st) => ({
          alerts: st.alerts.map((a) => (a.id === id ? { ...a, triggeredAt: null, triggeredPrice: null } : a)),
        })),
    }),
    { name: "openterminal-alerts" }
  )
);

export function isTriggered(op: PriceAlert["op"], target: number, price: number): boolean {
  return op === ">=" ? price >= target : price <= target;
}
