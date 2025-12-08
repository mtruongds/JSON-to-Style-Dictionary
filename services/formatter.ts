import { StyleDictionaryToken } from '../types';

interface FlatToken {
  path: string[];
  token: StyleDictionaryToken;
}

const isPlainObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// Check for Figma color object structure
const isFigmaColorValue = (val: any): boolean => {
  return isPlainObject(val) && 
         'components' in val && 
         Array.isArray(val.components) &&
         ('colorSpace' in val || 'alpha' in val);
};

const getFigmaColorString = (val: any): string => {
    const { components, alpha } = val;
    // Safety check
    if (!Array.isArray(components) || components.length < 3) {
        return '#000000';
    }
    
    const r = Math.round(components[0] * 255);
    const g = Math.round(components[1] * 255);
    const b = Math.round(components[2] * 255);
    let a = (alpha !== undefined) ? alpha : 1;
    
    // Ensure alpha is a clean number (max 4 decimals)
    a = Math.round(a * 10000) / 10000;

    if (a >= 0.9999) {
        const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } else {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
};

// Helper to strip top-level keys (flattens one level deep)
const removeTopLevelKeys = (obj: any): any => {
  if (!isPlainObject(obj)) return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (isPlainObject(value)) {
      Object.assign(newObj, value);
    }
  });
  return newObj;
};

const flattenTokens = (obj: any, path: string[] = []): FlatToken[] => {
  let tokens: FlatToken[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newPath = [...path, key];
      const value = obj[key];

      const isToken = value && 
                      typeof value === 'object' &&
                      Object.prototype.hasOwnProperty.call(value, 'value') &&
                      Object.prototype.hasOwnProperty.call(value, 'type');

      if (isToken) {
        tokens.push({ path: newPath, token: value as StyleDictionaryToken });
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        tokens = tokens.concat(flattenTokens(value, newPath));
      }
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

    // Note: Transformer normally handles this, but if keepFigmaFormat is true, this handles it.
    if (isFigmaColorValue(token.value)) {
        const colorString = getFigmaColorString(token.value);
        return `  --${name}: ${colorString};`;
    }
    
    if (isPlainObject(token.value)) {
        // Expand composite tokens (e.g. typography)
        const valObj = token.value as Record<string, any>;
        return Object.entries(valObj).map(([prop, val]) => {
            const kebabProp = camelToKebab(prop);
            return `  --${name}-${kebabProp}: ${val};`;
        }).join('\n');
    }
    return `  --${name}: ${token.value};`;
  }).join('\n');
  
  const selector = (mode === 'default') ? ':root' : `[data-theme="${mode}"]`;
  return `${selector} {\n${variables}\n}`;
};

const toScssVariables = (tokensObject: object, prefix: string): string => {
  const flatTokens = flattenTokens(tokensObject);
  return flatTokens.map(({ path, token }) => {
    let name = path.join('-');
    if (prefix) name = `${prefix}-${name}`;

    if (isFigmaColorValue(token.value)) {
        const colorString = getFigmaColorString(token.value);
        return `$${name}: ${colorString};`;
    }

    if (isPlainObject(token.value)) {
        // Expand composite tokens
        const valObj = token.value as Record<string, any>;
        return Object.entries(valObj).map(([prop, val]) => {
            const kebabProp = camelToKebab(prop);
            return `$${name}-${kebabProp}: ${val};`;
        }).join('\n');
    }
    return `$${name}: ${token.value};`;
  }).join('\n');
};

/**
 * Recursively traverses an object and renames 'value'/'type' keys to '$value'/'$type'
 * for W3C Design Token format compatibility.
 * @param {any} obj - The object to process.
 * @returns {any} The transformed object.
 */
const traverseAndRenameToW3C = (obj: any): any => {
    if (!isPlainObject(obj)) {
      return obj;
    }
  
    // Check if it's a Style Dictionary token
    const isToken = Object.prototype.hasOwnProperty.call(obj, 'value') &&
                    Object.prototype.hasOwnProperty.call(obj, 'type');
  
    if (isToken) {
      // It's a token, rename keys and return
      const { value, type, ...rest } = obj;
      return {
        $value: value,
        $type: type,
        ...rest,
      };
    }
  
    // It's a group, so recurse through its properties
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = traverseAndRenameToW3C(obj[key]);
      }
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

  // Apply structural flattening if excludeParentKeys is requested.
  // This affects all formats:
  // - JSON/W3C: The output object structure is flattened.
  // - CSS/SCSS: The variable names are shorter because the root path segment is gone.
  if (excludeParentKeys) {
    dataToFormat = removeTopLevelKeys(dataToFormat);
  }

  switch (format) {
    case 'css':
      return toCssVariables(dataToFormat, mode, prefix);
    case 'scss':
      return toScssVariables(dataToFormat, prefix);
    case 'w3c':
        const w3cObject = traverseAndRenameToW3C(dataToFormat);
        return JSON.stringify(w3cObject, null, 2);
    case 'json':
    default:
      return JSON.stringify(dataToFormat, null, 2);
  }
};