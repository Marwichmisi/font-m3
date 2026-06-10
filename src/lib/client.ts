import { log } from "./logger.js";
import { CliError } from "./errors.js";

const TIMEOUT_MS = 30_000;

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  timeout?: number;
  headers?: Record<string, string>;
}

async function request(method: Method, url: string, opts: RequestOptions = {}): Promise<unknown> {
  const headers: Record<string, string> = {
    ...opts.headers,
  };

  if (opts.body && method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  let fullUrl = url;
  if (opts.params && Object.keys(opts.params).length > 0) {
    const filtered = Object.fromEntries(
      Object.entries(opts.params).filter(([, v]) => v !== undefined && v !== ""),
    );
    if (Object.keys(filtered).length > 0) {
      fullUrl += `?${new URLSearchParams(filtered).toString()}`;
    }
  }

  log.debug(`${method} ${fullUrl}`);

  const res = await fetch(fullUrl, {
    method,
    headers,
    signal: AbortSignal.timeout(opts.timeout ?? TIMEOUT_MS),
    body: opts.body && method !== "GET" ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    throw new CliError(res.status, `${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    return res.json();
  }
  return res.text();
}

export const client = {
  get(path: string, params?: Record<string, string>, headers?: Record<string, string>) {
    return request("GET", path, { params, headers });
  },
  post(path: string, body?: Record<string, unknown>, headers?: Record<string, string>) {
    return request("POST", path, { body, headers });
  },
};
