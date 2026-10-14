// Stockage des médias (photos) dans IndexedDB : le localStorage est limité
// à ~5 Mo, insuffisant pour plusieurs photos. Ici on garde les fichiers
// d'origine, sans compression, et on ne met dans le post que des références légères.

const DB_NAME = "content-planner";
const STORE = "media";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("open"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("tx"));
        t.oncomplete = () => db.close();
        t.onerror = () => {
          try {
            db.close();
          } catch {
            /* ignore */
          }
        };
      })
  );
}

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  await tx("readwrite", (s) => s.put({ id, blob }));
}

export async function getBlob(id: string): Promise<Blob | null> {
  try {
    const rec = await tx<{ id: string; blob: Blob } | undefined>("readonly", (s) => s.get(id));
    return rec?.blob ?? null;
  } catch {
    return null;
  }
}

export async function deleteBlob(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function listBlobIds(): Promise<string[]> {
  try {
    const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
    return keys.map(String);
  } catch {
    return [];
  }
}

// Supprime les blobs qui ne sont référencés par aucun post.
export async function purgeBlobs(keepIds: Set<string>): Promise<void> {
  try {
    const all = await listBlobIds();
    await Promise.all(all.filter((id) => !keepIds.has(id)).map((id) => deleteBlob(id)));
  } catch {
    /* ignore */
  }
}
