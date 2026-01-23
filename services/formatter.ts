import { StyleDictionaryToken } from '../types';

interface FlatToken {
  path: string[];
  token: StyleDictionaryToken;
}

const isPlainObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Helper to extract RGBA components from Hex or RGBA string
 */
const getRgbaComponents = (color: string) => {
  let r = 0, g = 0, b = 0, a = 1;

  if (color.startsWith('#')) {
    const h = color.replace('#', '');
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else if (h.length === 4) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
      a = Math.round((parseInt(h[3] + h[3], 16) / 255) * 1000) / 1000;
    } else if (h.length === 6) {
      r = parseInt(h.substring(0, 2), 16);
      g = parseInt(h.substring(2, 4), 16);
      b = parseInt(h.substring(4, 6), 16);
    } else if (h.length === 8) {
      r = parseInt(h.substring(0, 2), 16);
      g = parseInt(h.substring(2, 4), 16);
      b = parseInt(h.substring(4, 6), 16);
      a = Math.round((parseInt(h.substring(6, 8), 16) / 255) * 1000) / 1000;
    }
    return { r, g, b, a };
  }

  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    r = parseInt(rgbaMatch[1], 10);
    g = parseInt(rgbaMatch[2], 10);
    b = parseInt(rgbaMatch[3], 10);
    a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
    return { r, g, b, a };
  }

  return null;
};

/**
 * Converts sRGB to OKLCH
 */
const rgbToOklch = (r: number, g: number, b: number, a: number): string => {
  // Normalize
  let nr = r / 255, ng = g / 255, nb = b / 255;
  
  // Linearize
  const lin = (c: number) => c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  nr = lin(nr); ng = lin(ng); nb = lin(nb);

  // To LMS
  const l = 0.4122214708 * nr + 0.5363325363 * ng + 0.0514459929 * nb;
  const m = 0.2119034982 * nr + 0.6806995451 * ng + 0.1073969566 * nb;
  const s = 0.0883024619 * nr + 0.2817188376 * ng + 0.6299787005 * nb;

  // Non-linear LMS
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // To OKLab
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  // To OKLCH
  const chroma = Math.sqrt(A * A + B * B);
  let hue = Math.atan2(B, A) * 180 / Math.PI;
  if (hue < 0) hue += 360;

  const L_fixed = Math.round(L * 1000) / 1000;
  const C_fixed = Math.round(chroma * 1000) / 1000;
  const H_fixed = Math.round(hue * 100) / 100;

  if (a === 1) return `oklch(${L_fixed} ${C_fixed} ${H_fixed})`;
  return `oklch(${L_fixed} ${C_fixed} ${H_fixed} / ${a})`;
};

/**
 * Formats a color value based on requested format
 */
const formatColor = (colorStr: any, format: 'rgba' | 'oklch'): string => {
  if (typeof colorStr !== 'string') return String(colorStr);
  
  const components = getRgbaComponents(colorStr);
  if (!components) return colorStr;
  
  const { r, g, b, a } = components;
  
  if (format === 'oklch') {
    return rgbToOklch(r, g, b, a);
  }

  if (a === 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const removeTopLevelKeys = (obj: any): any => {
  if (!isPlainObject(obj)) return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (isPlainObject(value)) Object.assign(newObj, value);
  });
  return newObj;
};

const flattenTokens = (obj: any, path: string[] = []): FlatToken[] => {
  let tokens: FlatToken[] = [];
  for (const key in obj) {
    const newPath = [...path, key];
    const value = obj[key];
    if (value && typeof value === 'object' && value.value !== undefined && value.type !== undefined) {
      tokens.push({ path: newPath, token: value as StyleDictionaryToken });
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      tokens = tokens.concat(flattenTokens(value, newPath));
    }
  }
  return tokens;
};

const camelToKebab = (str: string) => str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

const toCssVariables = (tokensObject: object, mode: string, prefix: string, colorFormat: 'rgba' | 'oklch'): string => {
  const flatTokens = flattenTokens(tokensObject);
  const variables = flatTokens.map(({ path, token }) => {
    let name = path.join('-');
    if (prefix) name = `${prefix}-${name}`;
    let value = token.value;
    
    if (isPlainObject(value)) {
        return Object.entries(value).map(([prop, val]) => {
            const kebabProp = camelToKebab(prop);
            const finalVal = (token.type === 'color' || prop.toLowerCase().includes('color')) ? formatColor(val, colorFormat) : val;
            return `  --${name}-${kebabProp}: ${finalVal};`;
        }).join('\n');
    }

    const finalValue = token.type === 'color' ? formatColor(value, colorFormat) : value;
    return `  --${name}: ${finalValue};`;
  }).join('\n');
  const selector = (mode === 'default') ? ':root' : `[data-theme="${mode}"]`;
  return `${selector} {\n${variables}\n}`;
};

const toScssVariables = (tokensObject: object, prefix: string, colorFormat: 'rgba' | 'oklch'): string => {
  const flatTokens = flattenTokens(tokensObject);
  return flatTokens.map(({ path, token }) => {
    let name = path.join('-');
    if (prefix) name = `${prefix}-${name}`;
    let value = token.value;
    
    if (isPlainObject(value)) {
        return Object.entries(value).map(([prop, val]) => {
            const kebabProp = camelToKebab(prop);
            const finalVal = (token.type === 'color' || prop.toLowerCase().includes('color')) ? formatColor(val, colorFormat) : val;
            return `$${name}-${kebabProp}: ${finalVal};`;
        }).join('\n');
    }

    const finalValue = token.type === 'color' ? formatColor(value, colorFormat) : value;
    return `$${name}: ${finalValue};`;
  }).join('\n');
};

const traverseAndRenameToW3C = (obj: any): any => {
    if (!isPlainObject(obj)) return obj;
    if (obj.value !== undefined && obj.type !== undefined) {
      const { value, type, description } = obj;
      const w3cToken: any = { $value: value, $type: type };
      if (description) w3cToken.$description = description;
      return w3cToken;
    }
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (key === 'extensions' || key === '$extensions') continue;
        newObj[key] = traverseAndRenameToW3C(obj[key]);
    }
    return newObj;
};

export const FORMATS = [
  { value: 'json', label: 'Style Dictionary (JSON)', extension: 'json', mime: 'application/json' },
  { value: 'w3c', label: 'W3C Design Tokens', extension: 'json', mime: 'application/json' },
  { value: 'css', label: 'CSS Variables', extension: 'css', mime: 'text/css' },
  { value: 'scss', label: 'SCSS Variables', extension: 'scss', mime: 'text/scss' },
];

export const formatTokensByMode = (
    tokensObject: object, 
    format: 'json' | 'css' | 'scss' | 'w3c', 
    mode: string,
    excludeParentKeys: boolean = false,
    prefix: string = '',
    colorFormat: 'rgba' | 'oklch' = 'rgba'
): string => {
  let dataToFormat = tokensObject;
  if (excludeParentKeys) dataToFormat = removeTopLevelKeys(dataToFormat);
  switch (format) {
    case 'css': return toCssVariables(dataToFormat, mode, prefix, colorFormat);
    case 'scss': return toScssVariables(dataToFormat, prefix, colorFormat);
    case 'w3c': return JSON.stringify(traverseAndRenameToW3C(dataToFormat), null, 2);
    default: return JSON.stringify(dataToFormat, null, 2);
  }
};