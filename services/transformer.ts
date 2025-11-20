
import { StyleDictionaryToken } from '../types';

const isPlainObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Helper to normalize references from slash notation to dot notation
 * e.g. {font/size/small} -> {font.size.small}
 */
const normalizeReference = (val: string): string => {
    return val.replace(/{([^}]+)}/g, (match, content) => {
        return `{${content.replace(/\//g, '.')}}`;
    });
};

/**
 * Maps Figma textCase to CSS text-transform
 */
const mapTextCase = (val: string): string => {
    const map: Record<string, string> = {
        'ORIGINAL': 'none',
        'UPPERCASE': 'uppercase',
        'LOWERCASE': 'lowercase',
        'TITLE': 'capitalize'
    };
    return map[val] || 'none';
};

/**
 * Maps Figma textDecoration to CSS text-decoration
 */
const mapTextDecoration = (val: string): string => {
    const map: Record<string, string> = {
        'NONE': 'none',
        'UNDERLINE': 'underline',
        'STRIKETHROUGH': 'line-through'
    };
    return map[val] || 'none';
};

/**
 * Specialized converter for Figma Plugin Export format (Arrays of styles)
 */
const convertFigmaPluginExport = (json: any): any => {
    const result: any = {};

    if (Array.isArray(json.textStyles)) {
        const textTokens: any = {};
        json.textStyles.forEach((style: any) => {
            const token: any = {
                type: 'typography',
                value: {},
                description: style.description || '',
                $extensions: {}
            };

            if (style.id) {
                token.$extensions.styleId = style.id;
            }

            const val: any = {};

            // FontFamily
            if (style.fontFamily) val.fontFamily = normalizeReference(style.fontFamily);

            // FontStyle / FontWeight logic
            // Input "fontStyle" in this format usually contains the weight name (e.g. "Medium")
            const styleName = style.fontStyle || 'Regular';
            const lowerStyle = styleName.toLowerCase();
            const weights = ['thin', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'];
            
            if (weights.includes(lowerStyle)) {
                val.fontWeight = `{font.weight.${lowerStyle}}`;
                val.fontStyle = 'normal';
            } else {
                // Fallback if it's something like "Italic" or unknown
                if (lowerStyle.includes('italic')) {
                     val.fontStyle = 'italic';
                     // Try to extract weight if composite like "Bold Italic"
                     const weightPart = weights.find(w => lowerStyle.includes(w));
                     val.fontWeight = weightPart ? `{font.weight.${weightPart}}` : '400'; 
                } else {
                    val.fontWeight = styleName; 
                    val.fontStyle = 'normal'; 
                }
            }

            // FontSize
            if (style.fontSize) {
                val.fontSize = normalizeReference(String(style.fontSize));
            }

            // LineHeight
            if (style.lineHeight) {
                val.lineHeight = normalizeReference(String(style.lineHeight));
            }

            // LetterSpacing
            if (style.letterSpacing) {
                val.letterSpacing = normalizeReference(String(style.letterSpacing));
            }

            // Paragraph Indent -> text-indent
            if (style.paragraphIndent !== undefined) {
                val['text-indent'] = String(style.paragraphIndent);
            }
            
            // Paragraph Spacing -> margin-block-start
            if (style.paragraphSpacing !== undefined) {
                val['margin-block-start'] = String(style.paragraphSpacing);
            }

            // Text Case
            if (style.textCase) {
                val['text-transform'] = mapTextCase(style.textCase);
            } else {
                val['text-transform'] = 'none';
            }

            // Text Decoration
            if (style.textDecoration) {
                val['text-decoration'] = mapTextDecoration(style.textDecoration);
            } else {
                val['text-decoration'] = 'none';
            }

            token.value = val;
            textTokens[style.name] = token;
        });
        result.text = textTokens;
    }

    return result;
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

  const type = Object.prototype.hasOwnProperty.call(obj, 'type')
    ? obj.type
    : Object.prototype.hasOwnProperty.call(obj, '$type')
    ? obj.$type
    : undefined;

  if (
    isPlainObject(value) &&
    !Object.prototype.hasOwnProperty.call(value, 'value') &&
    !Object.prototype.hasOwnProperty.call(value, '$value')
  ) {
    let isModeMap = true;

    // Heuristic for Composite Tokens (Typography, TextStyle, etc.)
    const compositeTypes = ['typography', 'textStyle', 'border', 'shadow', 'transition', 'blur', 'gradient'];
    
    if (type && compositeTypes.includes(type)) {
        const hasPrimitiveValues = Object.values(value).some(v => typeof v !== 'object' || v === null);
        if (hasPrimitiveValues) {
            isModeMap = false;
        }
    }

    if (isModeMap) {
        Object.keys(value).forEach(key => modes.add(key));
    }
  }


  // Recurse into child properties.
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key === 'value' || key === '$value' || key === 'type' || key === '$type' || key === 'description') {
          continue;
      }
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
  
  const isToken = Object.prototype.hasOwnProperty.call(currentObj, 'value') &&
                  Object.prototype.hasOwnProperty.call(currentObj, 'type');

  if (isToken) {
    const finalToken = { ...currentObj };

    const parentKey = path.length > 1 ? path[path.length - 2] : null;
    const grandParentKey = path.length > 2 ? path[path.length - 3] : null;

    if (grandParentKey === 'font' && parentKey === 'letter-spacing' && finalToken.type === 'number') {
        finalToken.type = 'letterSpacing';
    } else if (grandParentKey === 'font' && parentKey === 'style' && finalToken.type === 'string') {
        finalToken.type = 'fontStyle';
    }
    
    if (finalToken.type === 'fontStyle') {
      return finalToken;
    }

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
    
    if (typesThatNeedPxUnit.includes(finalToken.type) && typeof finalToken.value === 'number') {
      finalToken.value = `${finalToken.value}px`;
    }

    // Rule: Handle composite typography tokens (supports both 'typography' and 'textStyle')
    if ((finalToken.type === 'typography' || finalToken.type === 'textStyle') && isPlainObject(finalToken.value)) {
        const typographyValue = finalToken.value as Record<string, any>;
        const dimensionProps = ['fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'spacing'];
        
        for (const prop of dimensionProps) {
            if (Object.prototype.hasOwnProperty.call(typographyValue, prop)) {
                if (typeof typographyValue[prop] === 'number') {
                    typographyValue[prop] = `${typographyValue[prop]}px`;
                }
            }
        }
    }
    
    return finalToken;

  } else {
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
 * The main transformation function.
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

  // CHECK: Figma Plugin Export Format
  // If the JSON has a top-level 'textStyles' array, we treat it as the Figma specific format
  if (Object.prototype.hasOwnProperty.call(parsedJson, 'textStyles') && Array.isArray(parsedJson.textStyles)) {
      try {
          // We return a default mode object directly, bypassing standard traversal
          return { default: convertFigmaPluginExport(parsedJson) };
      } catch (e) {
          throw new Error('Error converting Figma plugin format: ' + (e instanceof Error ? e.message : 'Unknown error'));
      }
  }

  try {
    const modes = new Set<string>();
    findModes(parsedJson, modes);

    const modeList = Array.from(modes);

    if (modeList.length === 0) {
      return { default: traverseAndTransform(parsedJson) };
    }

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
