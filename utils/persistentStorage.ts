import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type PersistentStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
};

const createMemoryStorage = (): PersistentStorage => {
  const store = new Map<string, string>();

  return {
    async getItem(key) {
      return store.get(key) ?? null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async removeItem(key) {
      store.delete(key);
    },
    async clear() {
      store.clear();
    },
  };
};

const createWebStorage = (): PersistentStorage => {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    console.log("Web storage unavailable, falling back to memory store");
    return createMemoryStorage();
  }

  return {
    async getItem(key) {
      try {
        const value = window.localStorage.getItem(key);
        if (value === null || value === undefined) {
          return null;
        }
        try {
          JSON.parse(value);
          return value;
        } catch {
          console.log("localStorage value is not valid JSON, clearing", key);
          window.localStorage.removeItem(key);
          return null;
        }
      } catch (error) {
        console.log("localStorage getItem failed", key, error);
        return null;
      }
    },
    async setItem(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        console.log("localStorage setItem failed", key, error);
      }
    },
    async removeItem(key) {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.log("localStorage removeItem failed", key, error);
      }
    },
    async clear() {
      try {
        window.localStorage.clear();
      } catch (error) {
        console.log("localStorage clear failed", error);
      }
    },
  };
};

const createNativeStorage = (): PersistentStorage => {
  return {
    async getItem(key) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value === null || value === undefined) {
          return null;
        }
        try {
          JSON.parse(value);
          return value;
        } catch {
          console.log("AsyncStorage value is not valid JSON, clearing", key);
          await AsyncStorage.removeItem(key);
          return null;
        }
      } catch (error) {
        console.log("AsyncStorage getItem failed", key, error);
        return null;
      }
    },
    async setItem(key, value) {
      try {
        await AsyncStorage.setItem(key, value);
      } catch (error) {
        console.log("AsyncStorage setItem failed", key, error);
      }
    },
    async removeItem(key) {
      try {
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.log("AsyncStorage removeItem failed", key, error);
      }
    },
    async clear() {
      try {
        await AsyncStorage.clear();
      } catch (error) {
        console.log("AsyncStorage clear failed", error);
      }
    },
  };
};

export const persistentStorage: PersistentStorage = Platform.OS === "web" ? createWebStorage() : createNativeStorage();
