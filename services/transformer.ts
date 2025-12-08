import { StyleDictionaryToken } from '../types';

export interface TransformOptions {
  keepFigmaFormat?: boolean;
}

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
 * Helper to convert Figma color object structure to string (Hex or RGBA)
 */
const convertFigmaColorToString = (val: any): string | null => {
  if (
    isPlainObject(val) &&
    Array.isArray(val.components) &&
    val.components.length >= 3
  ) {
    const r = Math.round(val.components[0] * 255);
    const g = Math.round(val.components[1] * 255);
    const b = Math.round(val.components[2] * 255);
    let a = val.alpha !== undefined ? val.alpha : 1;
    
    // Normalize alpha
    // Using 4 decimal places for precision, but stripping trailing zeros via parseFloat
    const normalizedAlpha = parseFloat(a.toFixed(4));
    
    if (normalizedAlpha >= 0.9999) {
        // Return HEX
        const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } else {
        // Return RGBA
        return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
    }
  }
  return null;
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
 * Recursively scans an object to find all unique mode keys within token values or extensions.
 * @param {any} obj - The object to scan.
 * @param {Set<string>} modes - A Set to collect the mode names.
 */
const findModes = (obj: any, modes: Set<string>): void => {
  if (!isPlainObject(obj)) {
    return;
  }

  // 1. Check for value-based modes (e.g. { value: { light: "...", dark: "..." } })
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

    // Heuristic for Figma Color Objects
    // These keys indicate the object is a value definition, not a map of modes.
    if (
        Object.prototype.hasOwnProperty.call(value, 'hex') ||
        Object.prototype.hasOwnProperty.call(value, 'colorSpace') ||
        Object.prototype.hasOwnProperty.call(value, 'components') ||
        Object.prototype.hasOwnProperty.call(value, 'alpha')
    ) {
        isModeMap = false;
    }

    if (isModeMap) {
        Object.keys(value).forEach(key => modes.add(key));
    }
  }

  // 2. Check for extensions-based modes (e.g. { $extensions: { mode: { Web: "...", Mobile: "..." } } })
  const extensions = obj.extensions || obj.$extensions;
  if (isPlainObject(extensions) && isPlainObject(extensions.mode)) {
      Object.keys(extensions.mode).forEach(key => modes.add(key));
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
 * @param {TransformOptions} options - Transformation options.
 * @param {string} [mode] - The specific mode to resolve values for.
 * @param {string[]} path - The path to the current object in the JSON tree.
 * @returns {any} The transformed object or value.
 */
const traverseAndTransform = (obj: any, options: TransformOptions, mode?: string, path: string[] = []): any => {
  if (!isPlainObject(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => traverseAndTransform(item, options, mode, path));
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
  
  // NEW: Resolve extensions-based mode value overrides
  const extensions = currentObj.extensions || currentObj.$extensions;
  if (mode && isPlainObject(extensions) && isPlainObject(extensions.mode)) {
      if (Object.prototype.hasOwnProperty.call(extensions.mode, mode)) {
          currentObj.value = extensions.mode[mode];
          // If the override is a string (alias), normalize it
          if (typeof currentObj.value === 'string') {
            currentObj.value = normalizeReference(currentObj.value);
          }
      }
  }
  
  // If a mode is specified, resolve the token's value for that specific mode first (standard value-based mode).
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

    // Helper: Normalize any string values (including default values) to use dot notation for aliases
    if (typeof finalToken.value === 'string') {
        finalToken.value = normalizeReference(finalToken.value);
    }

    const parentKey = path.length > 1 ? path[path.length - 2] : null;
    const grandParentKey = path.length > 2 ? path[path.length - 3] : null;

    if (grandParentKey === 'font' && parentKey === 'letter-spacing' && finalToken.type === 'number') {
        finalToken.type = 'letterSpacing';
    } else if (grandParentKey === 'font' && parentKey === 'style' && finalToken.type === 'string') {
        finalToken.type = 'fontStyle';
    }
    
    // Transform 'size' type to 'dimension'
    if (finalToken.type === 'size') {
        finalToken.type = 'dimension';
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

    // Rule: Quote fontFamily values if they are not aliases
    if (finalToken.type === 'fontFamily' && typeof finalToken.value === 'string') {
        const val = finalToken.value;
        // Check if it starts with { (alias)
        const isAlias = val.trim().startsWith('{');
        if (!isAlias) {
             const hasQuotes = (val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'));
             if (!hasQuotes) {
                 finalToken.value = `'${val}'`;
             }
        }
    }
    
    // Standardize Color if not keeping Figma format
    if (!options.keepFigmaFormat && finalToken.type === 'color' && isPlainObject(finalToken.value)) {
           const val = finalToken.value as any;
           
           // Check if it is a Figma-style color object (components + colorSpace) and convert to String (Hex or RGBA)
           const colorString = convertFigmaColorToString(val);
           if (colorString) {
             finalToken.value = colorString;
           } else if (val.hex) {
             // Fallback: Use hex if available
             finalToken.value = val.hex;
           }
    }

    // Rule: Handle composite typography tokens (supports both 'typography' and 'textStyle')
    if ((finalToken.type === 'typography' || finalToken.type === 'textStyle') && isPlainObject(finalToken.value)) {
        const typographyValue = finalToken.value as Record<string, any>;
        const dimensionProps = ['fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'spacing'];
        
        for (const prop of dimensionProps) {
            if (Object.prototype.hasOwnProperty.call(typographyValue, prop)) {
                // If it's a string, normalize references
                if (typeof typographyValue[prop] === 'string') {
                   typographyValue[prop] = normalizeReference(typographyValue[prop]);
                }
                // If it's a number, add px
                if (typeof typographyValue[prop] === 'number') {
                    typographyValue[prop] = `${typographyValue[prop]}px`;
                }
            }
        }

        // Handle fontFamily in composite token
        if (Object.prototype.hasOwnProperty.call(typographyValue, 'fontFamily')) {
             const val = typographyValue['fontFamily'];
             if (typeof val === 'string') {
                 const isAlias = val.trim().startsWith('{');
                 if (isAlias) {
                     typographyValue['fontFamily'] = normalizeReference(val);
                 } else {
                     const hasQuotes = (val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'));
                     if (!hasQuotes) {
                         typographyValue['fontFamily'] = `'${val}'`;
                     }
                 }
             }
        }
    }
    
    return finalToken;

  } else {
    const newObj: { [key: string]: any } = {};
    for (const key in currentObj) {
      if (Object.prototype.hasOwnProperty.call(currentObj, key)) {
        newObj[key] = traverseAndTransform(currentObj[key], options, mode, [...path, key]);
      }
    }
    return newObj;
  }
};

/**
 * The main transformation function.
 */
export const transformJsonToStyleDictionary = (jsonString: string, options: TransformOptions = {}): Record<string, object> => {
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
      return { default: traverseAndTransform(parsedJson, options) };
    }

    const result: Record<string, object> = {};
    for (const mode of modeList) {
      result[mode] = traverseAndTransform(parsedJson, options, mode);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown issue occurred.';
    throw new Error(`Transformation Error: ${message} Please check the structure of your design tokens.`);
  }
};