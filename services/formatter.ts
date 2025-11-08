import { StyleDictionaryToken } from '../types';

interface FlatToken {
  path: string[];
  token: StyleDictionaryToken;
}

const isPlainObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

const toCssVariables = (tokensObject: object, mode: string): string => {
  const flatTokens = flattenTokens(tokensObject);
  const variables = flatTokens.map(({ path, token }) => `  --${path.join('-')}: ${token.value};`).join('\n');
  const selector = (mode === 'default') ? ':root' : `[data-theme="${mode}"]`;
  return `${selector} {\n${variables}\n}`;
};

const toScssVariables = (tokensObject: object): string => {
  const flatTokens = flattenTokens(tokensObject);
  return flatTokens.map(({ path, token }) => `$${path.join('-')}: ${token.value};`).join('\n');
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
    mode: string
): string => {
  switch (format) {
    case 'css':
      return toCssVariables(tokensObject, mode);
    case 'scss':
      return toScssVariables(tokensObject);
    case 'w3c':
        const w3cObject = traverseAndRenameToW3C(tokensObject);
        return JSON.stringify(w3cObject, null, 2);
    case 'json':
    default:
      return JSON.stringify(tokensObject, null, 2);
  }
};