// Where everything the app writes lives — fetched filings, daily prices, the
// market snapshot, the accounts database. DATA_DIR moves it all at once: on a
// host, point it at the persistent disk so a redeploy keeps accounts and data.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DATA_DIR = process.env.DATA_DIR ?? join(ROOT, "data");
export const MARKET_DIR = join(DATA_DIR, "market");
export const PRICE_DIR = join(DATA_DIR, "prices");
export const SNAPSHOT_PATH = join(DATA_DIR, "market-snapshot.json");
export const DB_PATH = process.env.STOCKWISE_DB ?? join(DATA_DIR, "app.db");

// The built frontend (npm run build), served by the API server in production
export const DIST_DIR = join(ROOT, "dist");
