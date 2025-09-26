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

  // Heuristic: If an object has a 'value' property that is itself a plain object,
  // and that inner object does *not* look like a token (e.g., doesn't have its own 'value' key),
  // then we assume its keys are mode names.
  if (
    Object.prototype.hasOwnProperty.call(obj, 'value') &&
    isPlainObject(obj.value) &&
    !Object.prototype.hasOwnProperty.call(obj.value, 'value')
  ) {
    Object.keys(obj.value).forEach(key => modes.add(key));
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
 * @returns {any} The transformed object or value.
 */
const traverseAndTransform = (obj: any, mode?: string): any => {
  if (!isPlainObject(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => traverseAndTransform(item, mode));
  }

  let currentObj = { ...obj };

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
    const typesToDimension = [
      'lineHeight',
      'spacing',
      'fontSize',
      'size',
      'borderRadius',
    ];
    
    // Rule: If the token's type is in our list, change it to 'dimension'.
    if (typesToDimension.includes(currentObj.type)) {
      currentObj.type = 'dimension';
    }

    // Rule: Add 'px' unit to numeric dimension values. Preserve string values (like '150%').
    if (currentObj.type === 'dimension' && typeof currentObj.value === 'number') {
      currentObj.value = `${currentObj.value}px`;
    }
    
    return currentObj;

  } else {
    // This is a group of tokens, so we recurse into its properties.
    const newObj: { [key: string]: any } = {};
    for (const key in currentObj) {
      if (Object.prototype.hasOwnProperty.call(currentObj, key)) {
        newObj[key] = traverseAndTransform(currentObj[key], mode);
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
 * @throws {Error} Throws an error if the JSON string is invalid.
 */
export const transformJsonToStyleDictionary = (jsonString: string): Record<string, object> => {
  const parsedJson = JSON.parse(jsonString);

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
};