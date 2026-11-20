/** True when this browser lets the app save data (false in some private modes or with storage blocked). */
export function canPersist(storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safe()): boolean {
  if (!storage) return false;
  try {
    const k = '__motionx_probe__';
    storage.setItem(k, '1');
    storage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function safe(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const storageOk = typeof window === 'undefined' ? true : canPersist();
