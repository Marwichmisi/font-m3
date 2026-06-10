import { mkdir, symlink } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline/promises";
import { stdin as processStdin, stdout as processStdout } from "process";
import { Command } from "commander";
import { log } from "../lib/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = join(__dirname, "..");
const SKILL_DIR = join(CLI_ROOT, "skills", "font-m3-cli");
const ALL_DIRS = [".agents", ".claude", ".opencode"] as const;

async function askWhich(available: string[]): Promise<string[]> {
  const rl = createInterface({ input: processStdin, output: processStdout });
  console.log("Which directories do you want to create? (comma-separated, e.g. .agents,.claude)");
  console.log(`Available: ${available.join(", ")}`);
  const answer = (await rl.question("> ")).trim();
  rl.close();
  if (!answer) return [];
  return answer.split(",").map(s => s.trim()).filter(s => ALL_DIRS.includes(s as any));
}

export const initCommand = new Command("init")
  .description("Install the font-m3-cli skill into the current project (local only)")
  .action(async () => {
    if (!existsSync(SKILL_DIR)) {
      log.error(`Skill not found at ${SKILL_DIR}`);
      process.exit(1);
    }

    const cwd = process.cwd();
    const existing = ALL_DIRS.filter(d => existsSync(join(cwd, d)));
    const missing = ALL_DIRS.filter(d => !existing.includes(d));

    let linked = 0;
    for (const dir of existing) {
      const skillsDir = join(cwd, dir, "skills");
      const linkPath = join(skillsDir, "font-m3-cli");
      if (existsSync(linkPath)) continue;
      try {
        await mkdir(skillsDir, { recursive: true });
        await symlink(SKILL_DIR, linkPath, "dir");
        log.success(`${dir}/skills/font-m3-cli`);
        linked++;
      } catch { /* skip */ }
    }

    if (missing.length > 0) {
      const toCreate = await askWhich(missing);
      for (const dir of toCreate) {
        const skillsDir = join(cwd, dir, "skills");
        const linkPath = join(skillsDir, "font-m3-cli");
        try {
          await mkdir(skillsDir, { recursive: true });
          await symlink(SKILL_DIR, linkPath, "dir");
          log.success(`${dir}/skills/font-m3-cli`);
          linked++;
        } catch { /* skip */ }
      }
    }

    if (linked === 0) {
      log.info("Skill already installed.");
    } else {
      log.success(`Done — skill linked in ${linked} location(s)`);
    }
  });
