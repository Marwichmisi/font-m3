# font-m3-cli

Search, download, and generate code for Google Fonts — for Android Jetpack Compose, Material 3, and web.

No API key required (uses public Google Fonts endpoints).

## Install

```bash
npx api2cli install font-m3-cli
```

## Quick Start

```bash
# List fonts
font-m3-cli fonts list
font-m3-cli fonts list --search inter --limit 5
font-m3-cli fonts list --category "Sans Serif" --sort trending

# Get font details
font-m3-cli fonts info Roboto

# Download font files
font-m3-cli fonts download Inter --weights 400,700
font-m3-cli fonts download "Source Code Pro" --outdir ./my-fonts

# Generate Jetpack Compose code
font-m3-cli fonts compose Inter --weights 400,700 -p com.myapp -o Typography.kt

# Generate CSS
font-m3-cli fonts css "Playfair Display"

# Initialize a Material 3 theme
font-m3-cli theme init --display "Playfair Display" --body Inter --output ./app/theme

# List categories
font-m3-cli fonts categories
```

## Features

- **Search** — 1,900+ Google Fonts with search, category filter, sort, and unlimited results (`--limit 0`)
- **Download** — Download .ttf files by weight
- **Compose** — Generate Kotlin FontFamily + Material 3 Typography code
- **CSS** — Generate @font-face declarations with CDN URLs
- **Theme** — Scaffold a complete M3 theme: Font.kt, Type.kt, Theme.kt, Color.kt
- **Preview** — Open font specimen page in the browser
- **No API key required** — works with public Google Fonts endpoints

## Resources

Run `font-m3-cli --help` to see all commands.

## Global Flags

All commands support: `--json`, `--format <text|json|csv|yaml>`, `--verbose`, `--no-color`, `--no-header`
