interface CacheEntry<T> {
  data: T;
  version: string;
  cachedAt: number;
}
export class IndexedDbUtil {
  private static readonly DB_NAME = 'GiSimulatorCache';
  private static readonly VERSION = 3;
  private static readonly STORE_NAME = 'cache';
  private static readonly MAX_ITEMS = 500;
  private static readonly DEFAULT_TTL = 1000 * 60 * 60 * 24 * 1; // 1 день

  private static open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // =============================
  // CORE
  // =============================

  static async get<T>(
    key: string,
    version?: string | number | Date,
    ttl = this.DEFAULT_TTL
  ): Promise<T | null> {
    const db = await this.open();
    const verString = version?.toString();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const entry = req.result as CacheEntry<T> | undefined;
        if (!entry) return resolve(null);

        const expired = Date.now() - entry.cachedAt > ttl;
        const versionMismatch = verString !== undefined && entry.version !== verString;

        if (expired || versionMismatch) {
          resolve(null);
        } else {
          resolve(entry.data);
        }
      };

      req.onerror = () => reject(req.error);
    });
  }

  static async set<T>(
    key: string,
    data: T,
    version?: string | number | Date
  ): Promise<void> {
    const db = await this.open();
    const verString = version?.toString() || '1';

    const entry: CacheEntry<T> = {
      data,
      version: verString,
      cachedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.put(entry, key);

      tx.oncomplete = async () => {
        await this.cleanup();
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  // =============================
  // IMAGE HELPERS
  // =============================

  static async loadImage(
    url: string,
    key: string,
    version?: string | number | Date
  ): Promise<string> {
    const cached = await this.get<string>(key, version);
    if (cached) return cached;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Image fetch failed: ${url}`);
      }

      const blob = await response.blob();
      const base64 = await this.blobToBase64(blob);

      await this.set(key, base64, version);
      return base64;
    } catch (e) {
      console.error(`IndexedDbUtil.loadImage error for key ${key}:`, e);
      throw e;
    }
  }

  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  // =============================
  // CLEANUP
  // =============================

  private static async cleanup(): Promise<void> {
    const db = await this.open();

    const tx = db.transaction(this.STORE_NAME, 'readonly');
    const store = tx.objectStore(this.STORE_NAME);
    const keysReq = store.getAllKeys();

    keysReq.onsuccess = () => {
      const keys = keysReq.result;
      if (keys.length <= this.MAX_ITEMS) return;

      const removeCount = keys.length - this.MAX_ITEMS;
      const cleanTx = db.transaction(this.STORE_NAME, 'readwrite');
      const cleanStore = cleanTx.objectStore(this.STORE_NAME);

      for (let i = 0; i < removeCount; i++) {
        cleanStore.delete(keys[i]);
      }
    };
  }
}
