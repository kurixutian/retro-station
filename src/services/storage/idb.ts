// ---------------- ROM storage (IndexedDB) ----------------
let dbPromise: Promise<IDBDatabase> | null = null;

export const idbOpen = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const r = indexedDB.open('retro_station', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('roms');
    r.onsuccess = () => {
      const db = r.result;
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      res(db);
    };
    r.onerror = () => {
      dbPromise = null;
      rej(r.error);
    };
  });
  return dbPromise;
};

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

export const idbDeleteGameData = async (gameId: string): Promise<void> => {
  const keys = [
    gameId,
    `rom:${gameId}`,
    `srm:${gameId}`,
    `rtc:${gameId}`,
    `autosave:${gameId}`,
    `cover:${gameId}`,
    `state:${gameId}:1`,
    `state:${gameId}:2`,
    `state:${gameId}:3`,
    `state:${gameId}:4`,
  ];
  for (const k of keys) {
    await idbDelete(k).catch(() => {});
  }
};

export const idbGetAllKeys = async (): Promise<string[]> => {
  const db = (await idbOpen()) as IDBDatabase;
  return new Promise((res, rej) => {
    const q = db.transaction('roms', 'readonly').objectStore('roms').getAllKeys();
    q.onsuccess = () => {
      const keys = ((q.result as any[]) || []).map(String);
      res(keys);
    };
    q.onerror = () => rej(q.error);
  });
};
