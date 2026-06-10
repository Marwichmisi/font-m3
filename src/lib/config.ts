import { homedir } from "os";
import { join } from "path";

export const APP_NAME = "font-m3";
export const APP_CLI = "font-m3-cli";

export const BASE_URL = "https://fonts.google.com/metadata";

export const AUTH_TYPE = "none";
export const AUTH_HEADER = "key";

export const TOKEN_PATH = join(homedir(), ".config", "tokens", `${APP_NAME}-cli.txt`);

export const globalFlags = {
  json: false,
  format: "text" as "text" | "json" | "csv" | "yaml",
  verbose: false,
  noColor: false,
  noHeader: false,
};
