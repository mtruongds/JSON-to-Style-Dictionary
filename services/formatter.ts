import { StyleDictionaryToken } from '../types';

interface FlatToken {
  path: string[];
  token: StyleDictionaryToken;
}

const isPlainObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Helper to convert hex color strings to rgb() or rgba() format
 */
const hexToRgb = (hex: any): string => {
  if (typeof hex !== 'string' || !hex.startsWith('#')) return String(hex);
  
  let r = 0, g = 0, b = 0, a = 1;
  
  if (hex.length === 4) { // #RGB
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 5) { // #RGBA
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
    a = Math.round((parseInt(hex[4] + hex[4], 16) / 255) * 1000) / 1000;
  } else if (hex.length === 7) { // #RRGGBB
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  } else if (hex.length === 9) { // #RRGGBBAA
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
    a = Math.round((parseInt(hex.substring(7, 9), 16) / 255) * 1000) / 1000;
  } else {
    return hex;
  }

  if (a === 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// Helper for cleaning objects and removing metadata
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

const toCssVariables = (tokensObject: object, mode: string, prefix: string): string => {
  const flatTokens = flattenTokens(tokensObject);
  const variables = flatTokens.map(({ path, token }) => {
    let name = path.join('-');
    if (prefix) name = `${prefix}-${name}`;
    let value = token.value;
    
    if (isPlainObject(value)) {
        return Object.entries(value).map(([prop, val]) => {
            const kebabProp = camelToKebab(prop);
            // Convert to RGB if it's a color property and a hex value
            const finalVal = (token.type === 'color' || prop.toLowerCase().includes('color')) ? hexToRgb(val) : val;
            return `  --${name}-${kebabProp}: ${finalVal};`;
        }).join('\n');
    }

    const finalValue = token.type === 'color' ? hexToRgb(value) : value;
    return `  --${name}: ${finalValue};`;
  }).join('\n');
  const selector = (mode === 'default') ? ':root' : `[data-theme="${mode}"]`;
  return `${selector} {\n${variables}\n}`;
};

const toScssVariables = (tokensObject: object, prefix: string): string => {
  const flatTokens = flattenTokens(tokensObject);
  return flatTokens.map(({ path, token }) => {
    let name = path.join('-');
    if (prefix) name = `${prefix}-${name}`;
    let value = token.value;
    
    if (isPlainObject(value)) {
        return Object.entries(value).map(([prop, val]) => {
            const kebabProp = camelToKebab(prop);
            // Convert to RGB if it's a color property and a hex value
            const finalVal = (token.type === 'color' || prop.toLowerCase().includes('color')) ? hexToRgb(val) : val;
            return `$${name}-${kebabProp}: ${finalVal};`;
        }).join('\n');
    }

    const finalValue = token.type === 'color' ? hexToRgb(value) : value;
    return `$${name}: ${finalValue};`;
  }).join('\n');
};

/**
 * STRICT W3C CLEANUP: Only $value, $type, $description. No extensions.
 */
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
    prefix: string = ''
): string => {
  let dataToFormat = tokensObject;
  if (excludeParentKeys) dataToFormat = removeTopLevelKeys(dataToFormat);
  switch (format) {
    case 'css': return toCssVariables(dataToFormat, mode, prefix);
    case 'scss': return toScssVariables(dataToFormat, prefix);
    case 'w3c': return JSON.stringify(traverseAndRenameToW3C(dataToFormat), null, 2);
    default: return JSON.stringify(dataToFormat, null, 2);
  }
};