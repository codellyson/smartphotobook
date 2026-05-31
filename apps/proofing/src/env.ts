export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  /** Origin where the Worker is served — used to build absolute upload URLs. */
  PUBLIC_BASE_URL: string;
  /** Where rendered spread JPEGs are served from (public R2 domain in prod). */
  PUBLIC_BUCKET_BASE: string;
  /** Comma-separated allow-list for CORS. */
  TRUSTED_ORIGINS: string;
};
