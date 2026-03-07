import { describe, it, expect } from "vitest";
import { wsBroadcast } from "../core/ws-broadcast.js";

// Minimal mock WebSocket
function makeMockWs(readyState = 1 /* OPEN */) {
  const sent: string[] = [];
  return {
    readyState,
    send: (payload: string) => sent.push(payload),
    on: (_event: string, _handler: () => void) => {},
    _sent: sent,
  };
}

describe("WsBroadcaster", () => {
  it("emits nothing when no clients", () => {
    // No clients registered — should not throw
    expect(() => wsBroadcast.emit("scrape:start", { total: 5 })).not.toThrow();
  });

  it("sends JSON payload to registered clients", () => {
    const ws = makeMockWs();
    // Directly call internal register to test sending
    (wsBroadcast as any).clients.add(ws);

    wsBroadcast.emit("scrape:progress", { index: 1, total: 10, status: "ok" });

    expect(ws._sent).toHaveLength(1);
    const parsed = JSON.parse(ws._sent[0]!);
    expect(parsed.type).toBe("scrape:progress");
    expect(parsed.data.index).toBe(1);
    expect(parsed.ts).toBeTruthy();

    (wsBroadcast as any).clients.delete(ws);
  });

  it("skips closed clients", () => {
    const closedWs = makeMockWs(3 /* CLOSED */);
    (wsBroadcast as any).clients.add(closedWs);

    wsBroadcast.emit("scrape:complete", { total: 5, succeeded: 5 });

    // Closed client should not receive message
    expect(closedWs._sent).toHaveLength(0);

    (wsBroadcast as any).clients.delete(closedWs);
  });

  it("includes correct event type in payload", () => {
    const ws = makeMockWs();
    (wsBroadcast as any).clients.add(ws);

    wsBroadcast.emit("scrape:start", { total: 3 });
    const parsed = JSON.parse(ws._sent[0]!);
    expect(parsed.type).toBe("scrape:start");
    expect(parsed.data.total).toBe(3);

    (wsBroadcast as any).clients.delete(ws);
  });

  it("reports connection count", () => {
    const initialCount = wsBroadcast.connectionCount;
    const ws = makeMockWs();
    (wsBroadcast as any).clients.add(ws);

    expect(wsBroadcast.connectionCount).toBe(initialCount + 1);

    (wsBroadcast as any).clients.delete(ws);
    expect(wsBroadcast.connectionCount).toBe(initialCount);
  });
});
