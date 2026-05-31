// Client-side helpers for the preview Worker.
//
// No auth — anyone with the URL can view. The caller persists the
// revokeToken locally if they want to delete the link later.

export function cloudBase(): string {
  const env = import.meta.env.VITE_PROOFING_URL;
  if (env) return env.replace(/\/$/, "");
  return "http://localhost:8787";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${cloudBase()}${path}`, {
    ...init,
    headers: {
      ...(init?.body && typeof init.body === "string" ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || msg;
    } catch {
      /* not JSON */
    }
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return (await res.json()) as T;
}

// -------- create / upload / finalize / revoke --------

export type PreviewMeta = {
  title: string;
  date: string;
  size: string;
};

type InitResponse = {
  token: string;
  revokeToken: string;
  uploads: Array<{ idx: number; url: string; method: "PUT" }>;
};

export type PreviewResult = {
  token: string;
  revokeToken: string;
  url: string;
};

export async function createShare(args: {
  name: string;
  meta: PreviewMeta;
  jpegs: Uint8Array[];
  onProgress?: (done: number, total: number) => void;
}): Promise<PreviewResult> {
  const init = await api<InitResponse>("/api/share/init", {
    method: "POST",
    body: JSON.stringify({ name: args.name, meta: args.meta, spreadCount: args.jpegs.length }),
  });
  args.onProgress?.(0, args.jpegs.length);
  for (let i = 0; i < args.jpegs.length; i++) {
    const slot = init.uploads[i];
    const res = await fetch(slot.url, {
      method: slot.method,
      headers: { "content-type": "image/jpeg" },
      body: args.jpegs[i] as BodyInit,
    });
    if (!res.ok) throw new Error(`upload ${slot.idx} failed: ${res.status}`);
    args.onProgress?.(i + 1, args.jpegs.length);
  }
  await api(`/api/share/finalize?token=${encodeURIComponent(init.token)}`, { method: "POST" });
  return {
    token: init.token,
    revokeToken: init.revokeToken,
    url: `${cloudBase()}/p?token=${init.token}`,
  };
}

export async function revokeShare(token: string, revokeToken: string): Promise<void> {
  const params = new URLSearchParams({ token, revoke: revokeToken });
  await api(`/api/share?${params.toString()}`, { method: "DELETE" });
}

// -------- recent shares: localStorage-only registry --------

const RECENT_KEY = "smartphotobook_recent_previews_v1";
const MAX_RECENT = 20;

export type RecentShare = {
  token: string;
  revokeToken: string;
  url: string;
  name: string;
  createdAt: number;
  /** undefined if the user revoked it locally; the row sticks around so they see what happened. */
  revokedAt?: number;
};

export function recentShares(): RecentShare[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentShare[]) : [];
  } catch {
    return [];
  }
}

export function rememberShare(s: Omit<RecentShare, "createdAt"> & { createdAt?: number }): void {
  if (typeof window === "undefined") return;
  const entry: RecentShare = { ...s, createdAt: s.createdAt ?? Date.now() };
  const next = [entry, ...recentShares().filter((r) => r.token !== entry.token)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function markRevoked(token: string): void {
  if (typeof window === "undefined") return;
  const next = recentShares().map((r) =>
    r.token === token ? { ...r, revokedAt: Date.now() } : r,
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function forgetShare(token: string): void {
  if (typeof window === "undefined") return;
  const next = recentShares().filter((r) => r.token !== token);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
