import type { WebSocket } from "ws";

export type WsEventType =
  | "scrape:start"
  | "scrape:progress"
  | "scrape:complete"
  | "scrape:error";

export interface WsEvent {
  type: WsEventType;
  ts: string;
  data: Record<string, unknown>;
}

/** Singleton WebSocket broadcaster — shared between API server and CLI commands */
class WsBroadcaster {
  private clients = new Set<WebSocket>();

  register(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));
    ws.on("error", () => this.clients.delete(ws));
  }

  emit(type: WsEventType, data: Record<string, unknown> = {}): void {
    if (this.clients.size === 0) return;
    const payload = JSON.stringify({
      type,
      ts: new Date().toISOString(),
      data,
    });
    for (const client of this.clients) {
      try {
        if (client.readyState === 1 /* OPEN */) client.send(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  get connectionCount(): number {
    return this.clients.size;
  }
}

export const wsBroadcast = new WsBroadcaster();
