import { AsyncLocalStorage } from "node:async_hooks";
import type { WASocket } from "@whiskeysockets/baileys";

export const activeSocketStorage = new AsyncLocalStorage<WASocket>();

export function getActiveSocket(): WASocket | null {
  return activeSocketStorage.getStore() ?? null;
}
