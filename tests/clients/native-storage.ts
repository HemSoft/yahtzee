// Browser-only adapter and fault injection. These controls are not in native builds.
export interface StorageFaults { reads: number; writes: number; acknowledgments: number; removes: number; delay: number }
declare global { interface Window { __nativeStorage: StorageFaults } }
window.__nativeStorage = { reads: 0, writes: 0, acknowledgments: 0, removes: 0, delay: 0 };
function fail(kind: "reads" | "writes" | "acknowledgments" | "removes") {
  if (window.__nativeStorage[kind] > 0) { window.__nativeStorage[kind]--; throw new Error(`Injected storage ${kind} failure`); }
}
export default {
  async getItem(key: string) { fail("reads"); return localStorage.getItem(key); },
  async setItem(key: string, value: string) {
    if (window.__nativeStorage.delay) await new Promise((done) => setTimeout(done, window.__nativeStorage.delay));
    fail("writes"); localStorage.setItem(key, value); fail("acknowledgments");
  },
  async removeItem(key: string) { fail("removes"); localStorage.removeItem(key); },
};
