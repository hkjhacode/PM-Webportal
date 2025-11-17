export type DevRole = { role: string; state?: string; branch?: string };
export type DevUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  roles: DevRole[];
  state?: string;
  branch?: string;
  createdAt: number;
  updatedAt: number;
};

declare global {
  var __DEV_USER_STORE__: DevUser[] | undefined;
}

function store() {
  if (!global.__DEV_USER_STORE__) global.__DEV_USER_STORE__ = [];
  return global.__DEV_USER_STORE__!;
}

export function isDevMode() {
  return !process.env.MONGODB_URI;
}

export function getAllDevUsers() {
  return [...store()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 200);
}

export function findDevUserByEmail(email: string) {
  const e = email.toLowerCase();
  return store().find(u => u.email.toLowerCase() === e) || null;
}

export function findDevUserById(id: string) {
  return store().find(u => u.id === id) || null;
}

export function createDevUser(input: Omit<DevUser, 'id' | 'createdAt' | 'updatedAt'>) {
  const exists = findDevUserByEmail(input.email);
  if (exists) return null;
  const now = Date.now();
  const id = crypto.randomUUID();
  const doc: DevUser = { id, createdAt: now, updatedAt: now, ...input };
  store().push(doc);
  return doc;
}

export function updateDevUser(id: string, update: Partial<Omit<DevUser, 'id' | 'createdAt'>>) {
  const s = store();
  const idx = s.findIndex(u => u.id === id);
  if (idx === -1) return null;
  const prev = s[idx];
  const next: DevUser = { ...prev, ...update, updatedAt: Date.now() } as DevUser;
  s[idx] = next;
  return next;
}

export function deleteDevUser(id: string) {
  const s = store();
  const idx = s.findIndex(u => u.id === id);
  if (idx === -1) return false;
  s.splice(idx, 1);
  return true;
}

export function clearDevUsers() {
  global.__DEV_USER_STORE__ = [];
}