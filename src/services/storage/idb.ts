// ---------------- ROM storage (IndexedDB) ----------------
export const idbOpen = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open('retro_station', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('roms');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

export const idbPut = async (key: string, blob: any): Promise<boolean> => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('roms', 'readwrite');
    tx.objectStore('roms').put(blob, key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
};

export const idbGet = async (key: string): Promise<any> => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const q = db.transaction('roms').objectStore('roms').get(key);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
};

export const idbDelete = async (key: string): Promise<boolean> => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('roms', 'readwrite');
    tx.objectStore('roms').delete(key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
};

export const idbGetAllKeys = async (): Promise<string[]> => {
  const db = (await idbOpen()) as IDBDatabase;
  return new Promise((res, rej) => {
    const q = db.transaction('roms', 'readonly').objectStore('roms').getAllKeys();
    q.onsuccess = () => {
      const keys = ((q.result as any[]) || []).map(String);
      const expanded = new Set(keys);
      keys.forEach((k) => {
        if (k.startsWith('rom_')) expanded.add(`rom:${k}`);
      });
      res(Array.from(expanded));
    };
    q.onerror = () => rej(q.error);
  });
};
