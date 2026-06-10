import { Command } from "commander";
import { getToken, setToken, removeToken, hasToken, maskToken } from "../lib/auth.js";
import { log } from "../lib/logger.js";

export const authCommand = new Command("auth")
  .description("Manage API authentication");

authCommand
  .command("set")
  .description("Save your Google API key (optional — public API works without it)")
  .argument("<token>", "Your Google API key")
  .addHelpText("after", "\nExample:\n  font-m3-cli auth set YOUR_API_KEY")
  .action((token: string) => {
    setToken(token);
    log.success("API key saved");
  });

authCommand
  .command("show")
  .description("Display current API key (masked by default)")
  .option("--raw", "Show the full unmasked key")
  .addHelpText("after", "\nExample:\n  font-m3-cli auth show")
  .action((opts: { raw?: boolean }) => {
    if (!hasToken()) {
      log.warn("No API key configured. font-m3-cli works without one!");
      return;
    }
    const token = getToken();
    console.log(opts.raw ? token : `API key: ${maskToken(token)}`);
  });

authCommand
  .command("remove")
  .description("Delete the saved API key")
  .addHelpText("after", "\nExample:\n  font-m3-cli auth remove")
  .action(() => {
    removeToken();
    log.success("API key removed");
  });

authCommand
  .command("test")
  .description("Test API key validity")
  .addHelpText("after", "\nExample:\n  font-m3-cli auth test")
  .action(async () => {
    if (!hasToken()) {
      log.warn("No API key configured. font-m3-cli works without one!");
      return;
    }
    const key = getToken();
    try {
      const res = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${key}&sort=popularity`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        log.success("API key is valid");
      } else {
        log.error(`API key rejected: ${res.status} ${res.statusText}`);
      }
    } catch {
      log.error("Could not verify API key (network error)");
    }
  });
