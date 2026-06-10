---
name: font-m3
description: "Search Google Fonts, download font files, and generate Jetpack Compose / Material 3 code for Android and web. Use when user mentions 'Google Fonts', 'Jetpack Compose fonts', 'Material 3 typography', 'download font', 'font files for Android', or wants to set up typography for a Compose app."
category: devtools
---

# font-m3-cli

## When To Use This Skill

Use the `font-m3-cli` skill when you need to:

- Search or browse the Google Fonts catalog from the terminal
- Get detailed info about a specific font family (variants, weights, subsets, category)
- Download font .ttf files for use in Android, web, or desktop projects
- Generate Jetpack Compose Kotlin code with FontFamily declarations and Material 3 Typography
- Generate CSS @font-face declarations for web projects
- Initialize a complete Material 3 theme (Font.kt, Type.kt, Theme.kt, Color.kt) with custom fonts
- Preview a font in the browser via fonts.google.com

## Capabilities

- **fonts list** — List all Google Fonts with optional `--search`, `--category`, `--sort`, `--limit`
- **fonts info** — Get full details on a font: variants, weights, subsets, axes, designers, popularity
- **fonts download** — Download .ttf files for a font family; filter by `--weights`
- **fonts compose** — Generate Kotlin code for Jetpack Compose + Material 3 Typography
- **fonts css** — Generate CSS @font-face rules with real fonts.gstatic.com URLs
- **fonts preview** — Open the Google Fonts specimen page for a font in the browser
- **fonts categories** — List all font categories with font counts (Sans Serif, Serif, Display, etc.)
- **theme init** — Scaffold a complete Material 3 theme: Font.kt, Type.kt, Theme.kt, Color.kt

No API key required — uses the public Google Fonts metadata endpoint and CSS API.

## Common Use Cases

- "Find a monospace font on Google Fonts and list its available weights"
- "Download Inter font files for my Android app"
- "Generate Jetpack Compose code for Roboto with weights 400 and 700"
- "Initialize a Material 3 theme using Playfair Display for headings and Inter for body text"
- "Get CSS @font-face declarations for Source Code Pro"
- "See all available Google Fonts categories and how many fonts each has"
- "Check what variants and subsets Open Sans supports"

## Setup

If `font-m3-cli` is not found, install and build it:
```bash
bun --version || curl -fsSL https://bun.sh/install | bash
npx api2cli bundle font-m3
npx api2cli link font-m3
```

`api2cli link` adds `~/.local/bin` to PATH automatically. The CLI is available in the next command.

Always use `--json` flag when calling commands programmatically.

## Working Rules

- Always use `--json` for agent-driven calls so downstream steps can parse the result.
- Start with `--help` if the exact action or flags are unclear instead of guessing.
- For Android font downloads: copy .ttf files to `app/src/main/res/font/` after downloading.

## Authentication

Google Fonts public API does **not** require authentication. The `auth` commands are provided for the optional Google Developer API key (not needed for basic usage).

```bash
font-m3-cli auth show    # Check if a key is configured
font-m3-cli auth remove  # Remove the key
```

## Resources

### fonts — Search, download, and generate code for Google Fonts

| Command | Arguments | Flags | Description |
|---------|-----------|-------|-------------|
| `list` | — | `--search`, `--category`, `--sort`, `--limit`, `--fields`, `--json`, `--format` | List fonts with optional filtering |
| `info` | `<family>` | `--json`, `--format` | Get font family details |
| `download` | `<family>` | `--weights`, `--outdir`, `--json` | Download .ttf font files |
| `compose` | `<family>` | `--weights`, `--package`, `--output` | Generate Jetpack Compose + M3 code |
| `css` | `<family>` | `--weights` | Generate CSS @font-face declarations |
| `preview` | `<family>` | `--text`, `--weights` | Open Google Fonts preview in browser |
| `categories` | — | `--json`, `--format` | List all categories with font counts |

### theme — Generate Material 3 theme files

| Command | Arguments | Flags | Description |
|---------|-----------|-------|-------------|
| `init` | — | `--display`, `--headline`, `--body`, `--label`, `--output`, `--package` | Scaffold Font.kt, Type.kt, Theme.kt, Color.kt |

## Output Format

`--json` returns a standardized envelope:
```json
{ "ok": true, "data": [ ... ], "meta": { "total": 42 } }
```

On error: `{ "ok": false, "error": { "message": "...", "status": 1 } }`

## Quick Reference

```bash
font-m3-cli --help                              # List all resources and global flags
font-m3-cli fonts --help                        # List all font actions
font-m3-cli fonts list --search inter           # Search fonts by name
font-m3-cli fonts list --category Monospace     # Filter by category
font-m3-cli fonts info Roboto                   # Get font details
font-m3-cli fonts download Inter -w 400,700     # Download specific weights
font-m3-cli fonts compose Inter -p com.myapp    # Generate Compose code
font-m3-cli fonts css "Source Code Pro"         # Generate CSS
font-m3-cli fonts preview Playfair              # Open browser preview
font-m3-cli theme init --display Inter --body Roboto -o ./theme  # Init M3 theme
```

## Global Flags

All commands support: `--json`, `--format <text|json|csv|yaml>`, `--verbose`, `--no-color`, `--no-header`

Exit codes: 0 = success, 1 = API error, 2 = usage error
