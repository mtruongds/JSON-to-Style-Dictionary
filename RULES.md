# Design Token Transformation Rules

This document outlines the logic used to convert Figma-exported JSON into Style Dictionary and W3C-compliant tokens.

## 1. Type Mapping (Figma Scopes)
Figma-specific scopes are mapped to standard token types to ensure correct platform transforms.

| Figma Scope | W3C / Style Dictionary Type | Note |
| :--- | :--- | :--- |
| `GAP` | `spacing` | |
| `CORNER_RADIUS` | `borderRadius` | |
| `WIDTH_HEIGHT` | `dimension` | |
| `LINE_HEIGHT` | `lineHeight` | |
| `LETTER_SPACING` | `letterSpacing` | |
| `FONT_SIZE` | `fontSize` | |
| `FONT_FAMILY` | `fontFamily` | |
| `FONT_STYLE` | `fontWeight` (if value is 100-900) or `fontStyle` (if "italic", etc.) | |
| `OPACITY` | `opacity` | Values are divided by 100 (e.g., 50 -> 0.5) |
| `STROKE_FLOAT` | `dimension` | |

## 2. Alias Resolution
Figma variables often use slashes. These are converted to the dot-notation required by most design token engines.

- **Source:** `color/brand/primary`
- **Reference Output:** `{color.brand.primary}`
- **Figma Extension Mapping:** If `com.figma.aliasData` is found, the `targetVariableName` is extracted and formatted as a reference `{path.to.token}`.

## 3. Font Style & Weight Logic
Figma stores weight and style under a single "Style" name. The converter uses the following logic:
- If the value is a **number** (e.g., `500`): Type becomes `fontWeight`.
- If the value is a **text string** (e.g., `Italic`): Type becomes `fontStyle`.

## 4. Typography Sanitization
- **Unit Appending:** Numeric values for `fontSize`, `lineHeight`, and `spacing` are automatically appended with `px`.
- **Font Quoting:** Font family names are wrapped in single quotes (e.g., `'Inter'`) unless they are references.

## 5. Color Flattening
Figma color components (0-1 scale) are converted to standard web formats:
- **Opaque:** `#RRGGBB`
- **Transparent:** `rgba(r, g, b, a)`

## 6. Metadata Handling
All `$extensions` and `com.figma.*` metadata are stripped during the final transformation to provide a clean output that won't cause errors in Style Dictionary build pipelines.
