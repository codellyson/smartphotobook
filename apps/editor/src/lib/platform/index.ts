// Default platform impl is `./web`. The Tauri build aliases `@/lib/platform`
// directly at `./desktop` via next.config.ts, so this file isn't reached in
// that case — but having it makes `@/lib/platform` resolvable without the
// alias too (e.g. for tests, ts-node, or future Vite migration paths).
export * from "./types";
export * from "./web";
