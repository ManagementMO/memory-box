// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldSnapshot } from "../src/lib/types";
import type {WorldSnapshotReceipt} from "../src/lib/client/world-snapshot";

const mocks = vi.hoisted(() => ({ publicApi: vi.fn(), fetchWorldSnapshot: vi.fn(), guestSession: vi.fn(), getBrowserSupabase: vi.fn() }));
vi.mock("../src/lib/client/api", () => ({ publicApi: mocks.publicApi }));
vi.mock("../src/lib/client/world-snapshot", () => ({ fetchWorldSnapshot: mocks.fetchWorldSnapshot }));
vi.mock("../src/lib/client/supabase", () => ({
  guestSession: mocks.guestSession,
  getBrowserSupabase: mocks.getBrowserSupabase,
  identityFromSession: (session: { user: { id: string } }) => ({ id: session.user.id, name: session.user.id, isAnonymous: true }),
  safeConnectionFailure: () => ({ name: "SyntheticError" }),
}));
import { useWorld } from "../src/lib/client/use-world";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const snapshot = (revision: number, epoch = 1): WorldSnapshot => ({
  worldId: "commons", revision, epoch, width: 120000, height: 120000, gridSize: 6,
  paintingPaused: false, pixels: [], memories: [], events: [],
});
const session = (id: string) => ({ access_token: "synthetic-unit-test-token", user: { id } });

describe("world connection lifecycle", () => {
  let root: Root;
  let container: HTMLDivElement;
  let current: ReturnType<typeof useWorld>;
  let mounted: boolean;
  let renders: number;
  const channels: Array<{ status?: (status: string) => void; on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> }> = [];
  const listeners: Array<{ callback: (event: string, value: ReturnType<typeof session> | null) => void; unsubscribe: ReturnType<typeof vi.fn> }> = [];
  const removeChannel = vi.fn(async () => "ok");

  function Harness() { current = useWorld(); renders++; return null; }
  async function mount(strict = false) {
    await act(async () => { root.render(strict ? createElement(StrictMode, null, createElement(Harness)) : createElement(Harness)); });
    mounted = true;
  }
  async function subscribeLatest() { await act(async () => { channels.at(-1)!.status!("SUBSCRIBED"); }); }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    mocks.publicApi.mockReset().mockResolvedValue(snapshot(1));
    mocks.fetchWorldSnapshot.mockReset().mockImplementation(async (_previous, options) => ({snapshot:await mocks.publicApi("/api/world", options),etag:null}));
    // Most refresh tests deliberately never admit a guest. No browser/network service is used.
    mocks.guestSession.mockReset().mockReturnValue(new Promise(() => {}));
    removeChannel.mockClear(); channels.length = 0; listeners.length = 0;
    mocks.getBrowserSupabase.mockReset().mockReturnValue({
      realtime: { setAuth: vi.fn(async () => {}) },
      channel: vi.fn(() => {
        const channel = { status: undefined as ((status: string) => void) | undefined, on: vi.fn(), subscribe: vi.fn() };
        channel.on.mockReturnValue(channel);
        channel.subscribe.mockImplementation((callback: (status: string) => void) => { channel.status = callback; return channel; });
        channels.push(channel);
        return channel;
      }),
      auth: { onAuthStateChange: vi.fn((callback: (event: string, value: ReturnType<typeof session> | null) => void) => {
        const listener = { callback, unsubscribe: vi.fn() };
        listeners.push(listener);
        return { data: { subscription: listener } };
      }) },
      removeChannel,
    });
    container = document.createElement("div"); document.body.append(container);
    root = createRoot(container); mounted = false; renders = 0;
  });
  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });

  it("aborts a stuck request on reconnect and rejects its late response without clearing the new request", async () => {
    const old = deferred<WorldSnapshot>(), replacement = deferred<WorldSnapshot>();
    mocks.publicApi.mockReset().mockReturnValueOnce(old.promise).mockReturnValueOnce(replacement.promise).mockResolvedValue(snapshot(3));
    await mount();
    const oldSignal = mocks.publicApi.mock.calls[0][1].signal as AbortSignal;
    await act(async () => current.retry());
    expect(oldSignal.aborted).toBe(true);
    expect(mocks.publicApi).toHaveBeenCalledTimes(2);
    await act(async () => old.resolve(snapshot(900, 99)));
    expect(current.world).toBeNull();
    let shared!: Promise<WorldSnapshot | null>;
    await act(async () => { shared = current.refresh(); });
    expect(mocks.publicApi).toHaveBeenCalledTimes(2);
    let result: WorldSnapshot | null = null;
    await act(async () => { replacement.resolve(snapshot(2)); result = await shared; });
    expect(result).toEqual(snapshot(3));
    expect(current.world).toEqual(snapshot(3));
  });

  it("coalesces notices into one follow-up while giving each waiter its own freshness horizon", async () => {
    await mount();
    const first = deferred<WorldSnapshot>(), followUp = deferred<WorldSnapshot>();
    mocks.publicApi.mockReset().mockReturnValueOnce(first.promise).mockReturnValueOnce(followUp.promise);
    let one!: Promise<WorldSnapshot | null>, two!: Promise<WorldSnapshot | null>;
    await act(async () => { one = current.refresh(); two = current.refresh(); });
    expect(mocks.publicApi).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve(snapshot(2)));
    expect(mocks.publicApi).toHaveBeenCalledTimes(2);
    let results: Array<WorldSnapshot | null> = [];
    await act(async () => { followUp.resolve(snapshot(3)); results = await Promise.all([one, two]); });
    expect(results).toEqual([snapshot(2), snapshot(3)]);
  });

  it("resolves an accepted-write refresh while sustained newer notices continue in the background", async () => {
    await mount();
    const old = deferred<WorldSnapshot>(), fresh = deferred<WorldSnapshot>(), background = deferred<WorldSnapshot>();
    mocks.publicApi.mockReset().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise).mockReturnValueOnce(background.promise);
    let beforeSave!: Promise<WorldSnapshot | null>, afterSave!: Promise<WorldSnapshot | null>;
    await act(async () => { beforeSave = current.refresh(); afterSave = current.refresh(); });
    await act(async () => old.resolve(snapshot(2)));
    expect(await beforeSave).toEqual(snapshot(2));
    expect(mocks.publicApi).toHaveBeenCalledTimes(2);
    const newer: Array<Promise<WorldSnapshot | null>> = [];
    await act(async () => { for (let index = 0; index < 20; index++) newer.push(current.refresh()); });
    let savedWorld: WorldSnapshot | null = null;
    await act(async () => { fresh.resolve(snapshot(3)); savedWorld = await afterSave; });
    expect(savedWorld).toEqual(snapshot(3));
    expect(mocks.publicApi).toHaveBeenCalledTimes(3);
    let backgroundFinished = false;
    void Promise.all(newer).then(() => { backgroundFinished = true; });
    await act(async () => {});
    expect(backgroundFinished).toBe(false);
    await act(async () => { background.resolve(snapshot(4)); await Promise.all(newer); });
    expect(backgroundFinished).toBe(true);
    expect(current.world).toEqual(snapshot(4));
  });

  it("releases active and queued callers on reconnect even if the old transport never settles", async () => {
    await mount();
    mocks.publicApi.mockReturnValueOnce(new Promise(() => {}));
    let active!: Promise<WorldSnapshot | null>, waiting!: Promise<WorldSnapshot | null>;
    await act(async () => { active = current.refresh(); waiting = current.refresh(); });
    await act(async () => current.retry());
    expect(await Promise.all([active, waiting])).toEqual([null, null]);
    expect(current.world).toEqual(snapshot(1));
  });

  it("returns the installed monotonic snapshot when an older revision or epoch arrives", async () => {
    mocks.publicApi.mockResolvedValue(snapshot(8, 2));
    await mount();
    for (const older of [snapshot(7, 2), snapshot(999, 1)]) {
      mocks.publicApi.mockResolvedValueOnce(older);
      let result: WorldSnapshot | null = null;
      await act(async () => { result = await current.refresh(); });
      expect(result).toEqual(snapshot(8, 2));
    }
    mocks.publicApi.mockResolvedValueOnce(snapshot(1, 3));
    await act(async () => { await current.refresh(); });
    expect(current.world).toEqual(snapshot(1, 3));
  });

  it("returns null on a failed refresh while retaining the last usable world", async () => {
    await mount();
    mocks.publicApi.mockRejectedValueOnce(new Error("Synthetic snapshot failure"));
    let result: WorldSnapshot | null = snapshot(100);
    await act(async () => { result = await current.refresh(); });
    expect(result).toBeNull();
    expect(current.world).toEqual(snapshot(1));
    expect(current.connection).toBe("error");
    expect(current.error).toBe("Synthetic snapshot failure");
  });

  it("keeps a validator paired with its accepted snapshot when an older body is rejected",async()=>{
    const installed={snapshot:snapshot(8,2),etag:'W/"current"'};
    mocks.fetchWorldSnapshot.mockResolvedValue(installed);await mount();
    expect(mocks.fetchWorldSnapshot.mock.calls[0][0]).toBeNull();
    mocks.fetchWorldSnapshot.mockResolvedValueOnce({snapshot:snapshot(7,2),etag:'W/"older"'});
    await act(async()=>{await current.refresh();});
    await act(async()=>{await current.refresh();});
    expect(mocks.fetchWorldSnapshot.mock.calls.at(-1)![0]).toBe(installed);
    expect(current.world).toBe(installed.snapshot);
  });

  it("installs changed index metadata at the same revision and accepts a newly identified world",async()=>{
    const original={snapshot:snapshot(8,2),etag:'W/"original"'};
    mocks.fetchWorldSnapshot.mockResolvedValue(original);await mount();
    const reindexed={snapshot:{...snapshot(8,2),memories:[{id:"image",imageDescription:"New caption"}] as WorldSnapshot["memories"]},etag:'W/"caption"'};
    mocks.fetchWorldSnapshot.mockResolvedValueOnce(reindexed);
    await act(async()=>{await current.refresh();});expect(current.world).toBe(reindexed.snapshot);
    const replacement={snapshot:{...snapshot(1),worldId:"another-world"},etag:'W/"another"'};
    mocks.fetchWorldSnapshot.mockResolvedValueOnce(replacement);
    await act(async()=>{await current.refresh();});expect(current.world).toBe(replacement.snapshot);
  });

  it("does not install the validator of a disposed request after reconnect",async()=>{
    const first={snapshot:snapshot(1),etag:'W/"first"'},late=deferred<WorldSnapshotReceipt>();
    mocks.fetchWorldSnapshot.mockResolvedValue(first);await mount();
    mocks.fetchWorldSnapshot.mockReturnValueOnce(late.promise);
    let pending!:Promise<WorldSnapshot|null>;await act(async()=>{pending=current.refresh();});
    const replacement={snapshot:snapshot(2),etag:'W/"replacement"'};mocks.fetchWorldSnapshot.mockResolvedValue(replacement);
    await act(async()=>{current.retry();});expect(await pending).toBeNull();
    await act(async()=>{late.resolve({snapshot:snapshot(900),etag:'W/"late"'});});
    await act(async()=>{await current.refresh();});
    expect(mocks.fetchWorldSnapshot.mock.calls.at(-1)![0]).toBe(replacement);
    expect(current.world).toBe(replacement.snapshot);
  });

  it("aborts on unmount and ignores completion from a fetch that does not honor its signal", async () => {
    const pending = deferred<WorldSnapshot>();
    mocks.publicApi.mockReturnValueOnce(pending.promise);
    await mount();
    const signal = mocks.publicApi.mock.calls[0][1].signal as AbortSignal;
    const oldRefresh = current.refresh;
    await act(async () => root.unmount()); mounted = false;
    expect(signal.aborted).toBe(true);
    const rendered = renders;
    await act(async () => pending.resolve(snapshot(9)));
    expect(renders).toBe(rendered);
    expect(await oldRefresh()).toBeNull();
    expect(mocks.publicApi).toHaveBeenCalledTimes(1);
  });

  it("survives Strict Mode effect replay without admitting the disposed generation's response", async () => {
    const old = deferred<WorldSnapshot>(), active = deferred<WorldSnapshot>();
    mocks.publicApi.mockReset().mockReturnValueOnce(old.promise).mockReturnValueOnce(active.promise);
    await mount(true);
    expect(mocks.publicApi).toHaveBeenCalledTimes(2);
    expect(mocks.publicApi.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { old.resolve(snapshot(900, 99)); active.resolve(snapshot(2)); });
    expect(current.world).toEqual(snapshot(2));
  });

  it("clears ended guest ownership immediately and only rejoins after an explicit retry", async () => {
    mocks.guestSession.mockResolvedValue(session("guest-one"));
    await mount(); await subscribeLatest();
    expect(current.identity?.id).toBe("guest-one");
    expect(current.connection).toBe("live");
    const oldChannel = channels[0], oldListener = listeners[0];
    await act(async () => oldListener.callback("SIGNED_OUT", null));
    expect(current.identity).toBeNull();
    expect(current.connection).toBe("error");
    expect(current.error).toContain("session ended");
    expect(oldListener.unsubscribe).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(oldChannel);
    await act(async () => { oldChannel.status!("SUBSCRIBED"); await current.refresh(); });
    expect(current.connection).not.toBe("live");
    expect(current.identity).toBeNull();
    expect(mocks.guestSession).toHaveBeenCalledTimes(1);
    mocks.guestSession.mockResolvedValue(session("guest-two"));
    await act(async () => current.retry());
    await subscribeLatest();
    expect(current.identity?.id).toBe("guest-two");
    expect(current.connection).toBe("live");
    expect(current.error).toBe("");
  });
});
