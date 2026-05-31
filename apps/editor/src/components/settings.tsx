
import React from "react";
import type { ProjectMeta } from "@/lib/data";

type SettingsProps = {
  meta: ProjectMeta;
  spreadCount: number;
  onChange: (next: ProjectMeta) => void;
  onExport: () => void;
  exporting: boolean;
  isDesktop: boolean;
};

const SIZE_OPTIONS = [
  '8 × 8"',
  '10 × 10"',
  '12 × 12"',
  '10 × 8"',
  '12 × 9"',
  '14 × 11"',
];

export function Settings({ meta, spreadCount, onChange, onExport, exporting, isDesktop }: SettingsProps) {
  const update = <K extends keyof ProjectMeta>(key: K, value: ProjectMeta[K]) =>
    onChange({ ...meta, [key]: value });

  const requiredPages = spreadCount * 2;
  const pagesShort = meta.pages < requiredPages;

  return (
    <div className="settings">
      <div className="settings-inner">
        <header className="settings-head">
          <p className="settings-eyebrow">Album info</p>
          <h2>Settings</h2>
          <p className="settings-lede">
            How this album shows up in your library, on the cover, and in client proofs.
          </p>
        </header>

        <section className="settings-section">
          <h3>Couple &amp; event</h3>
          <div className="settings-row">
            <label>
              <span>Couple</span>
              <input
                value={meta.couple}
                placeholder="e.g. Sarah & James"
                onChange={(e) => update("couple", e.target.value)}
              />
            </label>
            <label>
              <span>Album title</span>
              <input
                value={meta.title}
                placeholder="e.g. Summer Wedding"
                onChange={(e) => update("title", e.target.value)}
              />
            </label>
          </div>
          <div className="settings-row">
            <label>
              <span>Date</span>
              <input
                value={meta.date}
                placeholder="e.g. June 14, 2025"
                onChange={(e) => update("date", e.target.value)}
              />
            </label>
            <label>
              <span>Venue</span>
              <input
                value={meta.venue}
                placeholder="e.g. Hawthorne Estate"
                onChange={(e) => update("venue", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h3>Format</h3>
          <div className="settings-row">
            <label>
              <span>Trim size</span>
              <select value={meta.size} onChange={(e) => update("size", e.target.value)}>
                {SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Pages</span>
              <input
                type="number"
                min={0}
                step={2}
                value={meta.pages}
                onChange={(e) => update("pages", Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </label>
          </div>
          <div className={"settings-note" + (pagesShort ? " warn" : "")}>
            {spreadCount} spreads · uses {requiredPages} pages
            {pagesShort
              ? ` — page budget is short by ${requiredPages - meta.pages}. Bump pages up or remove a spread.`
              : meta.pages > requiredPages
                ? ` · ${meta.pages - requiredPages} blank pages reserved.`
                : ""}
          </div>
          <div className="settings-row">
            <label>
              <span>Export DPI</span>
              <select
                value={String(meta.exportDpi ?? 150)}
                onChange={(e) => update("exportDpi", parseInt(e.target.value, 10))}
              >
                <option value="96">Preview · 96 DPI</option>
                <option value="150">Standard · 150 DPI</option>
                <option value="300">Press-ready · 300 DPI</option>
              </select>
            </label>
            <div />
          </div>
          <div className="settings-note">
            Higher DPI takes longer to render but produces crisper PDFs for print labs.
          </div>
        </section>

        <section className="settings-section">
          <h3>Export</h3>
          <div className="settings-export-row">
            <div className="settings-export-info">
              <strong>{isDesktop ? "Press-ready PDF" : "Per-spread JPEGs"}</strong>
              <div className="settings-note">
                {isDesktop
                  ? "Each spread becomes one PDF page with bleed and crop marks. Hand straight to your print lab."
                  : "Each spread downloads as a JPEG. Install the desktop app for a real PDF export."}
              </div>
            </div>
            <button
              className="btn primary"
              disabled={exporting || spreadCount === 0}
              onClick={onExport}
            >
              {exporting ? "Exporting…" : isDesktop ? "Export PDF" : "Download JPEGs"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
