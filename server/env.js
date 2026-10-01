// Private settings (the Telegram bot key) from .env at the project root, for
// running on a laptop. A host sets them in its dashboard instead, and a
// variable already set in the environment wins over the file. Imported first
// by http-server.js, so everything after it sees the values.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const path = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(path)) process.loadEnvFile(path);
