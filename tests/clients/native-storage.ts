// Browser adapter for the mobile-source fixture, not a native storage test.
export default {
  async getItem(key: string) { return localStorage.getItem(key); },
  async setItem(key: string, value: string) { localStorage.setItem(key, value); },
};
