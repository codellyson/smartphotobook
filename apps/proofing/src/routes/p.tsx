import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import * as schema from "../db/schema";
import type { Env } from "../env";

export const pPage = new Hono<{ Bindings: Env }>();

const styles = `
  :root { color-scheme: dark; }
  body {
    margin: 0;
    background: #16151a;
    color: #ece6dc;
    font: 14px/1.5 ui-sans-serif, system-ui, sans-serif;
  }
  main { max-width: 1200px; margin: 0 auto; padding: 32px; }
  .eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #c98a5e; margin: 0 0 10px; }
  h1 { font: 600 36px/1.1 "Cormorant Garamond", "Times New Roman", serif; margin: 0 0 10px; }
  .sub { color: rgba(255,255,255,.6); margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; }
  .stage { display: grid; grid-template-columns: 60px 1fr 60px; align-items: center; gap: 12px; margin-bottom: 18px; }
  .nav { width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,.06); border: 0; color: inherit; font-size: 28px; cursor: pointer; }
  .nav:hover:not(:disabled) { background: rgba(255,255,255,.12); }
  .nav:disabled { opacity: .25; cursor: default; }
  .frame { background: rgba(0,0,0,.4); border-radius: 8px; overflow: hidden; aspect-ratio: 2/1; display: grid; place-items: center; }
  .frame img { width: 100%; height: 100%; object-fit: contain; }
  .dots { display: flex; gap: 6px; justify-content: center; margin-top: 8px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,.18); border: 0; cursor: pointer; padding: 0; }
  .dot.on { background: #c98a5e; }
  .empty { text-align: center; padding: 16vh 24px; }
  .counter { color: rgba(255,255,255,.5); font-variant-numeric: tabular-nums; margin-top: 12px; text-align: center; }
`;

const clientScript = (spreadsJson: string) => `
(function () {
  var spreads = ${spreadsJson};
  var index = 0;

  function render() {
    var sp = spreads[index];
    if (!sp) return;
    document.querySelector('.frame img').src = sp.image;
    document.querySelector('.nav.prev').disabled = index === 0;
    document.querySelector('.nav.next').disabled = index >= spreads.length - 1;
    document.querySelector('.counter').textContent = (index + 1) + ' of ' + spreads.length;
    var dots = document.querySelector('.dots');
    dots.innerHTML = '';
    spreads.forEach(function (s, i) {
      var b = document.createElement('button');
      b.className = 'dot' + (i === index ? ' on' : '');
      b.setAttribute('aria-label', 'Spread ' + (i + 1));
      b.addEventListener('click', function () { index = i; render(); });
      dots.appendChild(b);
    });
  }

  document.querySelector('.nav.prev').addEventListener('click', function () {
    index = Math.max(0, index - 1); render();
  });
  document.querySelector('.nav.next').addEventListener('click', function () {
    index = Math.min(spreads.length - 1, index + 1); render();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { index = Math.min(spreads.length - 1, index + 1); render(); }
    if (e.key === 'ArrowLeft')  { index = Math.max(0, index - 1); render(); }
  });

  render();
})();
`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

pPage.get("/p", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.html(
      `<!doctype html><html><head><title>Preview</title><style>${styles}</style></head>
       <body><main class="empty"><h1>No preview token</h1><p>Ask the sender to resend the link.</p></main></body></html>`,
    );
  }
  const db = getDb(c.env.DB);
  const link = await db.select().from(schema.proofingLinks).where(eq(schema.proofingLinks.token, token)).get();
  if (!link || link.revoked || !link.finalizedAt) {
    return c.html(
      `<!doctype html><html><head><title>Preview</title><style>${styles}</style></head>
       <body><main class="empty"><h1>Preview not found</h1><p>This link has been revoked or expired.</p></main></body></html>`,
    );
  }
  const imgs = await db
    .select()
    .from(schema.spreadImages)
    .where(eq(schema.spreadImages.linkToken, token))
    .all();
  imgs.sort((a, b) => a.idx - b.idx);
  const meta = JSON.parse(link.metaJson) as {
    title?: string;
    couple?: string;
    date?: string;
    venue?: string;
  };
  const spreads = imgs.map((r) => ({
    id: `s${r.idx}`,
    image: `${c.env.PUBLIC_BUCKET_BASE}/${r.r2Key}`,
  }));
  const heading = link.name || meta.title || "Photobook preview";
  const sub = [meta.date, meta.venue].filter(Boolean).join(" · ");

  return c.html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(heading)} — Preview</title>
  <style>${styles}</style>
</head>
<body>
  <main>
    <header class="head">
      <div>
        <p class="eyebrow">Photobook preview</p>
        <h1>${escapeHtml(heading)}</h1>
        ${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ""}
      </div>
    </header>
    <div class="stage">
      <button class="nav prev" aria-label="Previous spread">‹</button>
      <div class="frame"><img alt="Spread" /></div>
      <button class="nav next" aria-label="Next spread">›</button>
    </div>
    <div class="dots"></div>
    <div class="counter"></div>
  </main>
  <script>${clientScript(JSON.stringify(spreads))}</script>
</body>
</html>`);
});
