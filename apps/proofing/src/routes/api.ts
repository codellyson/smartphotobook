import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { Env } from "../env";
import { getDb } from "../db/client";
import * as schema from "../db/schema";
import { newToken, r2Key } from "../lib/tokens";

export const api = new Hono<{ Bindings: Env }>();

const MAX_SPREADS = 200;

type InitBody = {
  name: string;
  meta: { couple?: string; title?: string; date?: string; venue?: string; size?: string };
  spreadCount: number;
};

/** Reserve a token + R2 keys for an upcoming upload. Returns a revoke_token
 *  the caller must persist if they want to delete the share later — there's
 *  no auth here, so the token *is* the auth. */
api.post("/share/init", async (c) => {
  let body: InitBody;
  try {
    body = await c.req.json<InitBody>();
  } catch {
    return c.json({ error: "bad json" }, 400);
  }
  if (!body.spreadCount || body.spreadCount < 1) return c.json({ error: "no spreads" }, 400);
  if (body.spreadCount > MAX_SPREADS) return c.json({ error: "too many spreads" }, 413);

  const db = getDb(c.env.DB);
  const token = newToken();
  const revokeToken = newToken(24);
  const now = Date.now();

  await db.insert(schema.proofingLinks).values({
    token,
    revokeToken,
    name: body.name?.trim() || "Untitled photobook",
    metaJson: JSON.stringify(body.meta ?? {}),
    createdAt: now,
  });
  await db.insert(schema.spreadImages).values(
    Array.from({ length: body.spreadCount }, (_, i) => ({
      linkToken: token,
      idx: i + 1,
      r2Key: r2Key(token, i + 1),
    })),
  );

  const uploads = Array.from({ length: body.spreadCount }, (_, i) => ({
    idx: i + 1,
    url: `${c.env.PUBLIC_BASE_URL}/api/share/upload?token=${token}&idx=${i + 1}`,
    method: "PUT" as const,
  }));

  return c.json({ token, revokeToken, uploads });
});

api.put("/share/upload", async (c) => {
  const token = c.req.query("token");
  const idxStr = c.req.query("idx");
  if (!token || !idxStr) return c.json({ error: "missing token/idx" }, 400);
  const idx = parseInt(idxStr, 10);
  if (!Number.isFinite(idx) || idx < 1) return c.json({ error: "bad idx" }, 400);

  const db = getDb(c.env.DB);
  const link = await db.select().from(schema.proofingLinks).where(eq(schema.proofingLinks.token, token)).get();
  if (!link) return c.json({ error: "unknown token" }, 404);
  if (link.finalizedAt) return c.json({ error: "already finalized" }, 409);
  if (link.revoked) return c.json({ error: "revoked" }, 410);

  const row = await db
    .select()
    .from(schema.spreadImages)
    .where(and(eq(schema.spreadImages.linkToken, token), eq(schema.spreadImages.idx, idx)))
    .get();
  if (!row) return c.json({ error: "unknown spread idx" }, 404);

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) return c.json({ error: "empty body" }, 400);
  await c.env.BUCKET.put(row.r2Key, body, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  return c.json({ ok: true });
});

api.post("/share/finalize", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "missing token" }, 400);

  const db = getDb(c.env.DB);
  const link = await db.select().from(schema.proofingLinks).where(eq(schema.proofingLinks.token, token)).get();
  if (!link) return c.json({ error: "not found" }, 404);
  if (link.finalizedAt) return c.json({ token, finalizedAt: link.finalizedAt });

  const finalizedAt = Date.now();
  await db
    .update(schema.proofingLinks)
    .set({ finalizedAt })
    .where(eq(schema.proofingLinks.token, token));
  return c.json({ token, finalizedAt });
});

api.delete("/share", async (c) => {
  const token = c.req.query("token");
  const revoke = c.req.query("revoke");
  if (!token || !revoke) return c.json({ error: "missing token/revoke" }, 400);

  const db = getDb(c.env.DB);
  const link = await db.select().from(schema.proofingLinks).where(eq(schema.proofingLinks.token, token)).get();
  if (!link) return c.json({ error: "not found" }, 404);
  if (link.revokeToken !== revoke) return c.json({ error: "forbidden" }, 403);

  await db.update(schema.proofingLinks).set({ revoked: 1 }).where(eq(schema.proofingLinks.token, token));

  const imgs = await db
    .select()
    .from(schema.spreadImages)
    .where(eq(schema.spreadImages.linkToken, token))
    .all();
  await Promise.all(imgs.map((i) => c.env.BUCKET.delete(i.r2Key).catch(() => {})));
  return c.json({ ok: true });
});

/** Public read for the preview viewer. */
api.get("/proofing", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "missing token" }, 400);
  const db = getDb(c.env.DB);
  const link = await db.select().from(schema.proofingLinks).where(eq(schema.proofingLinks.token, token)).get();
  if (!link || link.revoked || !link.finalizedAt) return c.json({ error: "not found" }, 404);

  const imgs = await db
    .select()
    .from(schema.spreadImages)
    .where(eq(schema.spreadImages.linkToken, token))
    .all();
  imgs.sort((a, b) => a.idx - b.idx);

  return c.json({
    token: link.token,
    name: link.name,
    meta: JSON.parse(link.metaJson),
    spreads: imgs.map((r) => ({
      id: `s${r.idx}`,
      image: `${c.env.PUBLIC_BUCKET_BASE}/${r.r2Key}`,
    })),
    createdAt: link.createdAt,
  });
});
