import { CliError } from "./errors.js";
import { log } from "./logger.js";

const METADATA_URL = "https://fonts.google.com/metadata/fonts";
const CSS_API_URL = "https://fonts.googleapis.com/css2";
const TIMEOUT_MS = 30_000;

interface FontMetadata {
  family: string;
  displayName: string;
  category: string;
  subsets: string[];
  fonts: Record<string, { thickness: number | null; slant: number | null; width: number | null; lineHeight: number }>;
  axes: { tag: string; min: number; max: number; defaultValue: number }[];
  designers: string[];
  popularity: number;
  trending: number;
  lastModified: string;
  dateAdded: string;
  isNoto: boolean;
  isOpenSource: boolean;
  isBrandFont: boolean;
}

interface FontsResponse {
  familyMetadataList: FontMetadata[];
}

const metadataCache: { data: FontMetadata[]; ts: number } | null = null;

async function fetchMetadata(): Promise<FontMetadata[]> {
  const res = await fetch(METADATA_URL, {
    headers: { "User-Agent": "font-m3-cli/0.1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new CliError(res.status, `Failed to fetch font metadata: ${res.statusText}`);
  const raw = (await res.json()) as FontsResponse;
  return raw.familyMetadataList ?? [];
}

let cachedMetadata: FontMetadata[] | null = null;

export async function getAllFonts(): Promise<FontMetadata[]> {
  if (cachedMetadata) return cachedMetadata;
  cachedMetadata = await fetchMetadata();
  return cachedMetadata;
}

export async function listFonts(opts: {
  search?: string;
  category?: string;
  sort?: string;
  limit?: number;
}): Promise<FontMetadata[]> {
  let fonts = await getAllFonts();

  if (opts.search) {
    const q = opts.search.toLowerCase();
    fonts = fonts.filter((f) => f.family.toLowerCase().includes(q));
  }

  if (opts.category) {
    const cat = opts.category.toLowerCase();
    fonts = fonts.filter((f) => f.category.toLowerCase() === cat);
  }

  switch (opts.sort ?? "popularity") {
    case "name":
      fonts.sort((a, b) => a.family.localeCompare(b.family));
      break;
    case "dateAdded":
      fonts.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
      break;
    case "trending":
      fonts.sort((a, b) => a.trending - b.trending);
      break;
    case "popularity":
    default:
      fonts.sort((a, b) => a.popularity - b.popularity);
      break;
  }

  return fonts.slice(0, opts.limit ?? 50);
}

export async function getFont(family: string): Promise<FontMetadata | undefined> {
  const fonts = await getAllFonts();
  return fonts.find((f) => f.family.toLowerCase() === family.toLowerCase());
}

export interface FontVariant {
  weight: string;
  italic: boolean;
  url: string;
}

const variantUrlCache = new Map<string, FontVariant[]>();

export async function getFontVariants(family: string, weights?: string[]): Promise<FontVariant[]> {
  const cacheKey = `${family}|${weights?.join(",") ?? "all"}`;
  const cached = variantUrlCache.get(cacheKey);
  if (cached) return cached;

  let cssQuery = family.replace(/ /g, "+");
  if (weights && weights.length > 0) {
    cssQuery += `:wght@${weights.join(";")}`;
  }

  const url = `${CSS_API_URL}?family=${cssQuery}`;
  log.debug(`Fetching ${url}`);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new CliError(res.status, `Failed to fetch font CSS: ${res.statusText}`);

  const css = await res.text();
  const variants: FontVariant[] = [];
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
  let match;
  while ((match = fontFaceRegex.exec(css)) !== null) {
    const block = match[1];
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const styleMatch = block.match(/font-style:\s*(\w+)/);
    const srcMatch = block.match(/src:\s*url\(([^)]+)\)/);
    if (weightMatch && srcMatch) {
      variants.push({
        weight: weightMatch[1],
        italic: styleMatch?.[1] === "italic",
        url: srcMatch[1],
      });
    }
  }

  variantUrlCache.set(cacheKey, variants);
  return variants;
}

export async function downloadFont(family: string, variant: FontVariant, outdir: string): Promise<string> {
  const ext = variant.url.endsWith(".ttf") ? "ttf" : "woff2";
  const italicSuffix = variant.italic ? "i" : "";
  const filename = `${family.toLowerCase().replace(/ /g, "_")}_${variant.weight}${italicSuffix}.${ext}`;
  const filepath = `${outdir}/${filename}`;

  log.debug(`Downloading ${variant.url}`);
  const res = await fetch(variant.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new CliError(res.status, `Failed to download font file: ${res.statusText}`);

  const buffer = await res.arrayBuffer();
  await Bun.write(filepath, new Uint8Array(buffer));
  return filepath;
}

export function generateComposeCode(family: string, variants: FontVariant[], pkg?: string): string {
  const varNames = variants.map((v) => {
    const weightLabel = getWeightLabel(parseInt(v.weight));
    const italicLabel = v.italic ? "Italic" : "";
    return `${weightLabel}${italicLabel}`.replace(/ /g, "");
  });
  const safeFamily = family.replace(/[^a-zA-Z0-9]/g, "_");

  const fontEntries = variants.map((v, i) => {
    const weight = v.weight;
    const fontWeight = getWeightKotlin(parseInt(v.weight));
    const style = v.italic ? ", FontStyle.Italic" : "";
    const filename = `${family.toLowerCase().replace(/ /g, "_")}_${v.weight}${v.italic ? "i" : ""}.ttf`;
    return `        Font(R.font.${filename.replace(/\.ttf$/, "")}, FontWeight.${fontWeight}${style})`;
  });

  let code = `// Generated by font-m3-cli
// Font: ${family}
// Date: ${new Date().toISOString().split("T")[0]}
${pkg ? `package ${pkg}\n` : ""}
import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val ${safeFamily}FontFamily = FontFamily(
${fontEntries.join(",\n")}
)

`;

  const weights = [...new Set(variants.map((v) => parseInt(v.weight)))].sort((a, b) => a - b);
  const hasBold = weights.includes(700) || weights.includes(600);
  const hasRegular = weights.includes(400);

  code += `// Material 3 Typography using ${family}
// Use in your theme: MaterialTheme(colorScheme = scheme, typography = AppTypography)
val AppTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 57.sp,
        lineHeight = 64.sp,
        letterSpacing = (-0.25).sp,
    ),
    displayMedium = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 45.sp,
        lineHeight = 52.sp,
    ),
    displaySmall = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 36.sp,
        lineHeight = 44.sp,
    ),
    headlineLarge = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp,
        lineHeight = 40.sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 28.sp,
        lineHeight = 36.sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 24.sp,
        lineHeight = 32.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 22.sp,
        lineHeight = 28.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.15.sp,
    ),
    titleSmall = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.5.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.25.sp,
    ),
    bodySmall = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.4.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = ${safeFamily}FontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp,
    ),
)
`;

  return code;
}

export function generateCssCode(family: string, variants: FontVariant[]): string {
  const lines: string[] = [];
  lines.push(`/* Generated by font-m3-cli */`);
  lines.push(`/* Font: ${family} */`);
  lines.push(``);

  for (const v of variants) {
    const style = v.italic ? "italic" : "normal";
    lines.push(`@font-face {`);
    lines.push(`  font-family: '${family}';`);
    lines.push(`  font-style: ${style};`);
    lines.push(`  font-weight: ${v.weight};`);
    lines.push(`  src: url('${v.url}') format('truetype');`);
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

export const CATEGORIES = [
  "Sans Serif",
  "Serif",
  "Display",
  "Handwriting",
  "Monospace",
];

function getWeightLabel(weight: number): string {
  if (weight <= 100) return "Thin";
  if (weight <= 200) return "ExtraLight";
  if (weight <= 300) return "Light";
  if (weight <= 400) return "Regular";
  if (weight <= 500) return "Medium";
  if (weight <= 600) return "SemiBold";
  if (weight <= 700) return "Bold";
  if (weight <= 800) return "ExtraBold";
  return "Black";
}

function getWeightKotlin(weight: number): string {
  if (weight <= 100) return "Thin";
  if (weight <= 200) return "ExtraLight";
  if (weight <= 300) return "Light";
  if (weight <= 400) return "Normal";
  if (weight <= 500) return "Medium";
  if (weight <= 600) return "SemiBold";
  if (weight <= 700) return "Bold";
  if (weight <= 800) return "ExtraBold";
  return "Black";
}

export function getCategories(): string[] {
  return CATEGORIES;
}

export const FONT_FIELDS = ["family", "category", "popularity", "trending", "designers", "subsets", "variants"];
