import assert from "node:assert";
import test, { afterEach } from "node:test";
import { APPEARANCE_STORAGE_KEY, useUIStore } from "../stores/ui-store.ts";

type StorageStub = Pick<Storage, "getItem" | "setItem">;

function installStorage(stub: StorageStub) {
  Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true });
}

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(APPEARANCE_STORAGE_KEY, initial);
  installStorage({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
  return data;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
  useUIStore.setState({ appearance: "dark" });
});

test("hydrateAppearance applies a saved light choice over the dark default", () => {
  memoryStorage("light");
  useUIStore.setState({ appearance: "dark" });
  useUIStore.getState().hydrateAppearance();
  assert.strictEqual(useUIStore.getState().appearance, "light");
});

test("hydrateAppearance keeps the default when nothing valid is saved", () => {
  memoryStorage("sepia");
  useUIStore.setState({ appearance: "dark" });
  useUIStore.getState().hydrateAppearance();
  assert.strictEqual(useUIStore.getState().appearance, "dark");
});

test("setAppearance and toggleAppearance save the choice", () => {
  const data = memoryStorage();
  useUIStore.getState().setAppearance("light");
  assert.strictEqual(data.get(APPEARANCE_STORAGE_KEY), "light");

  useUIStore.getState().toggleAppearance();
  assert.strictEqual(useUIStore.getState().appearance, "dark");
  assert.strictEqual(data.get(APPEARANCE_STORAGE_KEY), "dark");
});

test("appearance still changes when browser storage is unavailable", () => {
  installStorage({
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  });
  useUIStore.setState({ appearance: "dark" });
  useUIStore.getState().hydrateAppearance();
  useUIStore.getState().toggleAppearance();
  assert.strictEqual(useUIStore.getState().appearance, "light");
});
