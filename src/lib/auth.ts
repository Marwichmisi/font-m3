import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, chmodSync } from "fs";
import { dirname } from "path";
import { TOKEN_PATH, APP_CLI } from "./config.js";
import { CliError } from "./errors.js";

export function hasToken(): boolean {
  return existsSync(TOKEN_PATH);
}

export function getToken(): string {
  if (!hasToken()) {
    throw new CliError(2, "No API key configured.", `Run: ${APP_CLI} auth set <api-key>\nGet a key at: https://console.cloud.google.com/apis/credentials`);
  }
  return readFileSync(TOKEN_PATH, "utf-8").trim();
}

export function setToken(token: string): void {
  mkdirSync(dirname(TOKEN_PATH), { recursive: true });
  writeFileSync(TOKEN_PATH, token.trim(), { mode: 0o600 });
  chmodSync(TOKEN_PATH, 0o600);
}

export function removeToken(): void {
  if (existsSync(TOKEN_PATH)) {
    unlinkSync(TOKEN_PATH);
  }
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function buildAuthHeaders(): Record<string, string> {
  return {};
}
