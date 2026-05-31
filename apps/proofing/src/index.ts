import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { api } from "./routes/api";
import { pPage } from "./routes/p";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const allowed = c.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  const handler = cors({
    origin: (origin) => (origin && allowed.includes(origin) ? origin : ""),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["content-type"],
  });
  return handler(c, next);
});

app.route("/api", api);
app.route("/", pPage);

// Local-dev R2 passthrough. Production points PUBLIC_BUCKET_BASE at a custom
// domain attached to the bucket and this route can stay as an emergency fallback.
app.get("/r2/*", async (c) => {
  const key = c.req.path.replace(/^\/r2\//, "");
  const obj = await c.env.BUCKET.get(key);
  if (!obj) return c.text("not found", 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=3600");
  return new Response(obj.body, { headers });
});

app.get("/", (c) =>
  c.text(
    `SmartPhotobook preview service.\n\n` +
      `POST /api/share/init      — create a preview link\n` +
      `PUT  /api/share/upload    — push one spread JPEG\n` +
      `POST /api/share/finalize  — finalize a preview\n` +
      `GET  /api/proofing?token  — public preview details\n` +
      `DEL  /api/share?token&revoke — revoke a preview (needs revoke token)\n` +
      `GET  /p?token             — public preview viewer\n`,
  ),
);

export default app;
