import { StyleDictionaryToken } from '../types';

interface FlatToken {
  path: string[];
  token: StyleDictionaryToken;
}

const isPlainObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
            return `  --${name}-${kebabProp}: ${val};`;
        }).join('\n');
    }
    return `  --${name}: ${value};`;
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
            return `$${name}-${kebabProp}: ${val};`;
        }).join('\n');
    }
    return `$${name}: ${value};`;
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