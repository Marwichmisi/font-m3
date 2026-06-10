import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { platform } from "os";
import { output } from "../lib/output.js";
import { handleError, CliError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { toKotlinWeight } from "../lib/weights.js";
import {
  listFonts,
  getFont,
  getFontVariants,
  downloadFont,
  generateComposeCode,
  generateCssCode,
} from "../lib/fonts-api.js";

interface ListOpts {
  search?: string;
  category?: string;
  sort?: string;
  limit?: string;
  json?: boolean;
  format?: string;
  fields?: string;
}

interface InfoOpts {
  json?: boolean;
  format?: string;
}

interface DownloadOpts {
  weights?: string;
  outdir?: string;
  json?: boolean;
}

interface ComposeOpts {
  weights?: string;
  package?: string;
  output?: string;
  json?: boolean;
}

interface CssOpts {
  weights?: string;
  json?: boolean;
}

export const fontsResource = new Command("fonts")
  .description("Search, download, and generate code for Google Fonts");

fontsResource
  .command("list")
  .description("List Google Fonts with optional search and filtering")
  .option("-s, --search <query>", "Search fonts by name")
  .option("-c, --category <cat>", "Filter by category (Sans Serif, Serif, Display, Handwriting, Monospace)")
  .option("--sort <field>", "Sort by: popularity, name, dateAdded, trending (default: popularity)")
  .option("-l, --limit <n>", "Max results to return (default: 50, 0 = no limit)")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .option("--fields <cols>", "Comma-separated columns to display (family,category,popularity,subsets)")
  .addHelpText("after", [
    "",
    "Examples:",
    "  font-m3-cli fonts list",
    "  font-m3-cli fonts list --search roboto",
    '  font-m3-cli fonts list --category "Sans Serif" --limit 10',
    "  font-m3-cli fonts list --sort trending --json",
  ].join("\n"))
  .action(async (opts: ListOpts) => {
    try {
      const limit = opts.limit ? parseInt(opts.limit) : 50;
      const fonts = await listFonts({
        search: opts.search,
        category: opts.category,
        sort: opts.sort,
        limit: Number.isNaN(limit) || limit <= 0 ? 9999 : limit,
      });

      const data = fonts.map((f) => ({
        family: f.family,
        category: f.category,
        popularity: f.popularity,
        trending: f.trending,
        designers: f.designers?.join(", ") ?? "",
        subsets: (f.subsets ?? []).slice(0, 5).join(", "),
        variants: Object.keys(f.fonts ?? {}).length,
        isNoto: f.isNoto ? "yes" : "no",
      }));

      const fields = opts.fields?.split(",");
      output(data, { json: opts.json, format: opts.format, fields });
    } catch (err) {
      handleError(err);
    }
  });

fontsResource
  .command("info")
  .description("Get detailed information about a specific font family")
  .argument("<family>", "Font family name (e.g. Roboto, Inter)")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", [
    "",
    "Examples:",
    "  font-m3-cli fonts info Roboto",
    '  font-m3-cli fonts info "Material Icons" --json',
  ].join("\n"))
  .action(async (family: string, opts: InfoOpts) => {
    try {
      const font = await getFont(family);
      if (!font) {
        handleError(new CliError(2, `Font "${family}" not found`));
        return;
      }

      const data = {
        family: font.family,
        category: font.category,
        popularity: font.popularity,
        trending: font.trending,
        designers: font.designers?.join(", ") ?? "",
        subsets: (font.subsets ?? []).join(", "),
        variants: Object.keys(font.fonts ?? {}).join(", "),
        axes: (font.axes ?? []).map((a) => `${a.tag} (${a.min}-${a.max})`).join(", "),
        lastModified: font.lastModified,
        dateAdded: font.dateAdded,
        isNoto: font.isNoto ? "yes" : "no",
        isOpenSource: font.isOpenSource ? "yes" : "no",
        isBrandFont: font.isBrandFont ? "yes" : "no",
      };

      output(data, { json: opts.json, format: opts.format });
    } catch (err) {
      handleError(err);
    }
  });

fontsResource
  .command("download")
  .description("Download font files for a font family")
  .argument("<family>", "Font family name (e.g. Roboto, Inter)")
  .option("-w, --weights <weights>", "Comma-separated weights to download (e.g. 400,700). Default: all")
  .option("-o, --outdir <dir>", "Output directory (default: ./<family>)")
  .option("--json", "Output as JSON")
  .addHelpText("after", [
    "",
    "Examples:",
    "  font-m3-cli fonts download Roboto",
    "  font-m3-cli fonts download Inter --weights 400,700,900",
    '  font-m3-cli fonts download "Source Code Pro" -o ./my-fonts',
  ].join("\n"))
  .action(async (family: string, opts: DownloadOpts) => {
    try {
      const font = await getFont(family);
      if (!font) {
        handleError(new CliError(2, `Font "${family}" not found`));
        return;
      }

      const weightList = opts.weights ? opts.weights.split(",").map((w) => w.trim()) : undefined;
      const outdir = opts.outdir ?? family.replace(/ /g, "_");

      if (!existsSync(outdir)) {
        mkdirSync(outdir, { recursive: true });
      }

      log.info(`Fetching variants for ${family}...`);
      const variants = await getFontVariants(family, weightList);

      if (variants.length === 0) {
        log.warn("No variants found for this font");
        return;
      }

      log.info(`Downloading ${variants.length} variant(s) to ${outdir}/`);

      const results: { weight: string; italic: boolean; file: string }[] = [];
      for (const v of variants) {
        const filepath = await downloadFont(family, v, outdir);
        const relpath = filepath.startsWith(process.cwd()) ? filepath.slice(process.cwd().length + 1) : filepath;
        log.success(`  ${v.weight}${v.italic ? "i" : ""} -> ${relpath}`);
        results.push({ weight: v.weight, italic: v.italic, file: relpath });
      }

      log.success(`Downloaded ${results.length} file(s) to ${outdir}/`);

      if (opts.json) {
        output(results, { json: true });
      }
    } catch (err) {
      handleError(err);
    }
  });

fontsResource
  .command("compose")
  .description("Generate Jetpack Compose / Material 3 code for a font family")
  .argument("<family>", "Font family name (e.g. Roboto, Inter)")
  .option("-w, --weights <weights>", "Comma-separated weights to include (e.g. 400,700). Default: all")
  .option("-p, --package <pkg>", "Kotlin package name")
  .option("-o, --output <file>", "Output file path (default: stdout)")
  .option("--json", "Output errors as JSON")
  .addHelpText("after", [
    "",
    "Examples:",
    "  font-m3-cli fonts compose Roboto",
    "  font-m3-cli fonts compose Inter --weights 400,700 -p com.myapp",
    '  font-m3-cli fonts compose "JetBrains Mono" -o Typography.kt',
  ].join("\n"))
  .action(async (family: string, opts: ComposeOpts) => {
    try {
      const font = await getFont(family);
      if (!font) {
        handleError(new CliError(2, `Font "${family}" not found`));
        return;
      }

      const weightList = opts.weights ? opts.weights.split(",").map((w) => w.trim()) : undefined;
      const variants = await getFontVariants(family, weightList);

      if (variants.length === 0) {
        log.warn("No variants found for this font");
        return;
      }

      const code = generateComposeCode(family, variants, opts.package);

      if (opts.output) {
        await Bun.write(opts.output, code);
        log.success(`Compose code written to ${opts.output}`);
      } else {
        console.log(code);
      }
    } catch (err) {
      handleError(err);
    }
  });

fontsResource
  .command("css")
  .description("Generate CSS @font-face declarations for a font family")
  .argument("<family>", "Font family name (e.g. Roboto, Inter)")
  .option("-w, --weights <weights>", "Comma-separated weights to include (e.g. 400,700). Default: all")
  .option("--json", "Output errors as JSON")
  .addHelpText("after", [
    "",
    "Examples:",
    "  font-m3-cli fonts css Roboto",
    "  font-m3-cli fonts css Inter --weights 400,700",
  ].join("\n"))
  .action(async (family: string, opts: CssOpts) => {
    try {
      const font = await getFont(family);
      if (!font) {
        handleError(new CliError(2, `Font "${family}" not found`));
        return;
      }

      const weightList = opts.weights ? opts.weights.split(",").map((w) => w.trim()) : undefined;
      const variants = await getFontVariants(family, weightList);

      if (variants.length === 0) {
        log.warn("No variants found for this font");
        return;
      }

      console.log(generateCssCode(family, variants));
    } catch (err) {
      handleError(err);
    }
  });

fontsResource
  .command("preview")
  .description("Open a font preview URL in the browser")
  .argument("<family>", "Font family name (e.g. Roboto)")
  .option("-t, --text <text>", "Preview text to display")
  .option("-w, --weights <weights>", "Comma-separated weights to preview")
  .addHelpText("after", [
    "",
    "Examples:",
    "  font-m3-cli fonts preview Roboto",
    '  font-m3-cli fonts preview Inter --text "Hello World"',
  ].join("\n"))
  .action((family: string, opts: { text?: string; weights?: string }) => {
    const encoded = family.replace(/ /g, "+");
    let url = `https://fonts.google.com/specimen/${encoded}`;
    if (opts.text) {
      url += `?preview.text=${encodeURIComponent(opts.text)}`;
    }
    if (opts.weights) {
      const sep = opts.text ? "&" : "?";
      url += `${sep}preview.size=${opts.weights}`;
    }
    log.info(`Opening ${url}`);
    const openCmd = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
    Bun.spawn([openCmd, url], { detached: true });
  });

fontsResource
  .command("categories")
  .description("List all font categories")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", [
    "",
    "Example:",
    "  font-m3-cli fonts categories",
  ].join("\n"))
  .action(async (opts: { json?: boolean; format?: string }) => {
    try {
      const fonts = await listFonts({ limit: 9999 });
      const categories = [...new Set(fonts.map((f) => f.category))].sort();
      const data = categories.map((cat) => {
        const count = fonts.filter((f) => f.category === cat).length;
        return { category: cat, count };
      });
      output(data, { json: opts.json, format: opts.format });
    } catch (err) {
      handleError(err);
    }
  });
