
import { StyleDictionaryToken } from '../types';

const isPlainObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Recursively scans an object to find all unique mode keys within token values.
 * @param {any} obj - The object to scan.
 * @param {Set<string>} modes - A Set to collect the mode names.
 */
const findModes = (obj: any, modes: Set<string>): void => {
  if (!isPlainObject(obj)) {
    return;
  }

  // Heuristic: If an object has a 'value' or '$value' property that is itself a plain object,
  // and that inner object does *not* look like a token (e.g., doesn't have its own 'value' or '$value' key),
  // then we assume its keys are mode names.
  const value = Object.prototype.hasOwnProperty.call(obj, 'value')
    ? obj.value
    : Object.prototype.hasOwnProperty.call(obj, '$value')
    ? obj.$value
    : undefined;

  if (
    isPlainObject(value) &&
    !Object.prototype.hasOwnProperty.call(value, 'value') &&
    !Object.prototype.hasOwnProperty.call(value, '$value')
  ) {
    Object.keys(value).forEach(key => modes.add(key));
  }


  // Recurse into child properties.
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      findModes(obj[key], modes);
    }
  }
};

/**
 * Recursively traverses an object and transforms it into Style Dictionary format.
 * If a mode is provided, it resolves token values for that specific mode.
 * @param {any} obj - The object or value to process.
 * @param {string} [mode] - The specific mode to resolve values for.
 * @param {string[]} path - The path to the current object in the JSON tree.
 * @returns {any} The transformed object or value.
 */
const traverseAndTransform = (obj: any, mode?: string, path: string[] = []): any => {
  if (!isPlainObject(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => traverseAndTransform(item, mode, path));
  }

  let currentObj = { ...obj };

  // Rule: Standardize $value and $type to value and type
  if (Object.prototype.hasOwnProperty.call(currentObj, '$value')) {
    currentObj.value = currentObj.$value;
    delete currentObj.$value;
  }
  if (Object.prototype.hasOwnProperty.call(currentObj, '$type')) {
    currentObj.type = currentObj.$type;
    delete currentObj.$type;
  }
  
  // If a mode is specified, resolve the token's value for that specific mode first.
  if (
    mode &&
    Object.prototype.hasOwnProperty.call(currentObj, 'value') &&
    isPlainObject(currentObj.value) &&
    Object.prototype.hasOwnProperty.call(currentObj.value, mode)
  ) {
    currentObj.value = currentObj.value[mode];
  }
  
  // A Style Dictionary token is an object with a 'value' property.
  // We also check for 'type' to be more specific and avoid changing non-token objects.
  const isToken = Object.prototype.hasOwnProperty.call(currentObj, 'value') &&
                  Object.prototype.hasOwnProperty.call(currentObj, 'type');

  if (isToken) {
    // This is a token object, so we process it and stop recursion.
    const finalToken = { ...currentObj };

    // Rule: Contextual type changes for typography
    const parentKey = path.length > 1 ? path[path.length - 2] : null;
    const grandParentKey = path.length > 2 ? path[path.length - 3] : null;

    if (grandParentKey === 'font' && parentKey === 'letter-spacing' && finalToken.type === 'number') {
        finalToken.type = 'letterSpacing';
    } else if (grandParentKey === 'font' && parentKey === 'style' && finalToken.type === 'string') {
        finalToken.type = 'fontStyle';
    }
    
    // Rule: Pass-through string-based types like fontStyle without further modification.
    if (finalToken.type === 'fontStyle') {
      return finalToken;
    }

    // Rule: Correct wrong 'number' type if value is a 'px' string
    if (finalToken.type === 'number' && typeof finalToken.value === 'string' && finalToken.value.endsWith('px')) {
      finalToken.type = 'dimension';
    }

    const typesThatNeedPxUnit = [
      'dimension',
      'fontSize',
      'lineHeight',
      'borderRadius',
      'spacing',
      'letterSpacing',
    ];
    
    // Rule: Add 'px' unit to numeric values for dimension-like types.
    if (typesThatNeedPxUnit.includes(finalToken.type) && typeof finalToken.value === 'number') {
      finalToken.value = `${finalToken.value}px`;
    }
    
    return finalToken;

  } else {
    // This is a group of tokens, so we recurse into its properties.
    const newObj: { [key: string]: any } = {};
    for (const key in currentObj) {
      if (Object.prototype.hasOwnProperty.call(currentObj, key)) {
        newObj[key] = traverseAndTransform(currentObj[key], mode, [...path, key]);
      }
    }
    return newObj;
  }
};

/**
 * The main transformation function. It detects modes and generates a separate
 * Style Dictionary object for each one.
 * @param {string} jsonString - The raw JSON string from the uploaded file.
 * @returns {Record<string, object>} An object where keys are mode names and
 *          values are the transformed Style Dictionary objects.
 * @throws {Error} Throws an error if the JSON string is invalid or the structure is unexpected.
 */
export const transformJsonToStyleDictionary = (jsonString: string): Record<string, object> => {
  let parsedJson;
  try {
    parsedJson = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Invalid JSON: The file could not be parsed. Please check for syntax errors like missing commas or quotes.');
  }

  if (!isPlainObject(parsedJson)) {
    throw new Error('Invalid Structure: The root of the JSON file must be an object.');
  }

  try {
    const modes = new Set<string>();
    findModes(parsedJson, modes);

    const modeList = Array.from(modes);

    // If no modes were found, perform a single, standard transformation.
    if (modeList.length === 0) {
      return { default: traverseAndTransform(parsedJson) };
    }

    // If modes were found, create a transformed object for each mode.
    const result: Record<string, object> = {};
    for (const mode of modeList) {
      result[mode] = traverseAndTransform(parsedJson, mode);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown issue occurred.';
    throw new Error(`Transformation Error: ${message} Please check the structure of your design tokens.`);
  }
};
