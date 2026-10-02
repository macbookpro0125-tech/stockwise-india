// Bounded, timeout-protected HTTP reads for public data providers. Callers get
// a small retry for transient failures and a typed error for the API boundary.
export class UpstreamError extends Error {
  constructor(service, message, { status = 502, code = "UPSTREAM_FAILURE", retryable = false } = {}) {
    super(`${service}: ${message}`);
    this.name = "UpstreamError";
    this.service = service;
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const retryStatus = status => status === 408 || status === 429 || status >= 500;

async function readBody(response, service, maxBytes) {
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > maxBytes) throw new UpstreamError(service, `response exceeded the ${maxBytes} byte limit`, { code: "UPSTREAM_TOO_LARGE" });
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new UpstreamError(service, `response exceeded the ${maxBytes} byte limit`, { code: "UPSTREAM_TOO_LARGE" });
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size).toString("utf8");
}

export async function fetchText(url, options = {}) {
  const {
    timeoutMs = 12_000,
    maxBytes = 20 * 1024 * 1024,
    retries = 1,
    notFoundAsNull = false,
    fetchImpl = fetch,
    onHeaders,
    service = (() => { try { return new URL(url).hostname; } catch { return "upstream"; } })(),
    ...requestOptions
  } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, { ...requestOptions, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = new UpstreamError(service, error.name === "TimeoutError" ? `request timed out after ${timeoutMs} ms` : "could not be reached", {
        status: error.name === "TimeoutError" ? 504 : 502,
        code: error.name === "TimeoutError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_NETWORK",
        retryable: true,
      });
      if (attempt < retries) { await pause(250 * (attempt + 1)); continue; }
      throw lastError;
    }
    if (response.status === 404 && notFoundAsNull) return null;
    if (!response.ok) {
      const retryable = retryStatus(response.status);
      lastError = new UpstreamError(service, `returned HTTP ${response.status}`, {
        status: response.status === 429 ? 503 : 502,
        code: `UPSTREAM_HTTP_${response.status}`,
        retryable,
      });
      if (retryable && attempt < retries) { await pause(250 * (attempt + 1)); continue; }
      throw lastError;
    }
    onHeaders?.(response.headers);
    try {
      return await readBody(response, service, maxBytes);
    } catch (error) {
      if (error instanceof UpstreamError && error.retryable && attempt < retries) { await pause(250 * (attempt + 1)); continue; }
      if (error instanceof UpstreamError) throw error;
      const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
      lastError = new UpstreamError(service, timedOut ? `request timed out after ${timeoutMs} ms` : "response could not be read", {
        status: timedOut ? 504 : 502,
        code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_READ",
        retryable: true,
      });
      if (attempt < retries) { await pause(250 * (attempt + 1)); continue; }
      throw lastError;
    }
  }
  throw lastError ?? new UpstreamError(service, "request failed");
}

export async function fetchJson(url, options = {}) {
  const service = options.service;
  const body = await fetchText(url, { ...options, service });
  if (body == null) return null;
  try { return JSON.parse(body); }
  catch { throw new UpstreamError(service || new URL(url).hostname, "returned invalid JSON", { code: "UPSTREAM_INVALID_JSON" }); }
}
