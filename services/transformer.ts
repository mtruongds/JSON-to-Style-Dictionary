import { StyleDictionaryToken } from '../types';

export interface TransformOptions {
  // Option for keeping original Figma format is removed as per request
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
 * Helper to ensure font family names are quoted if they are not references
 */
const quoteFontFamily = (val: any): any => {
    if (typeof val === 'string' && val.trim() !== '' && !val.startsWith('{') && !val.startsWith("'") && !val.startsWith('"')) {
        return `'${val}'`;
    }
    return val;
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
                description: style.description || ''
            };

            const val: any = {};

            if (style.fontFamily) {
                val.fontFamily = quoteFontFamily(normalizeReference(style.fontFamily));
            }

            const styleName = style.fontStyle || 'Regular';
            const lowerStyle = styleName.toLowerCase();
            const weights = ['thin', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'];
            
            if (weights.includes(lowerStyle)) {
                val.fontWeight = `{font.weight.${lowerStyle}}`;
                val.fontStyle = 'normal';
            } else {
                if (lowerStyle.includes('italic')) {
                     val.fontStyle = 'italic';
                     const weightPart = weights.find(w => lowerStyle.includes(w));
                     val.fontWeight = weightPart ? `{font.weight.${weightPart}}` : '400'; 
                } else {
                    val.fontWeight = styleName; 
                    val.fontStyle = 'normal'; 
                }
            }

            if (style.fontSize) val.fontSize = normalizeReference(String(style.fontSize));
            if (style.lineHeight) val.lineHeight = normalizeReference(String(style.lineHeight));
            if (style.letterSpacing) val.letterSpacing = normalizeReference(String(style.letterSpacing));
            if (style.paragraphIndent !== undefined) val['text-indent'] = String(style.paragraphIndent);
            if (style.paragraphSpacing !== undefined) val['margin-block-start'] = String(style.paragraphSpacing);
            if (style.textCase) val['text-transform'] = mapTextCase(style.textCase);
            else val['text-transform'] = 'none';
            if (style.textDecoration) val['text-decoration'] = mapTextDecoration(style.textDecoration);
            else val['text-decoration'] = 'none';

            token.value = val;
            textTokens[style.name] = token;
        });
        result.text = textTokens;
    }

    return result;
};

/**
 * Recursively scans an object to find all unique mode keys.
 */
const findModes = (obj: any, modes: Set<string>): void => {
  if (!isPlainObject(obj)) return;

  const value = obj.value !== undefined ? obj.value : obj.$value;
  const type = obj.type !== undefined ? obj.type : obj.$type;

  if (isPlainObject(value) && value.value === undefined && value.$value === undefined) {
    let isModeMap = true;
    const compositeTypes = ['typography', 'textStyle', 'border', 'shadow', 'transition', 'blur', 'gradient'];
    
    if (type && compositeTypes.includes(type)) {
        if (Object.values(value).some(v => typeof v !== 'object' || v === null)) {
            isModeMap = false;
        }
    }

    if (Object.prototype.hasOwnProperty.call(value, 'hex') || 
        Object.prototype.hasOwnProperty.call(value, 'components')) {
        isModeMap = false;
    }

    if (isModeMap) {
        Object.keys(value).forEach(key => modes.add(key));
    }
  }

  const extensions = obj.extensions || obj.$extensions;
  if (isPlainObject(extensions) && isPlainObject(extensions.mode)) {
      Object.keys(extensions.mode).forEach(key => modes.add(key));
  }

  for (const key in obj) {
    if (key === 'value' || key === '$value' || key === 'type' || key === '$type' || key === 'description') continue;
    findModes(obj[key], modes);
  }
};

/**
 * Traverses and transforms JSON, stripping all extensions after processing.
 */
const traverseAndTransform = (obj: any, options: TransformOptions, mode?: string, path: string[] = []): any => {
  if (!isPlainObject(obj)) return obj;
  if (Array.isArray(obj)) return obj.map(item => traverseAndTransform(item, options, mode, path));

  let currentObj = { ...obj };

  // Standardize keys
  if (currentObj.$value !== undefined) { currentObj.value = currentObj.$value; delete currentObj.$value; }
  if (currentObj.$type !== undefined) { currentObj.type = currentObj.$type; delete currentObj.$type; }
  if (currentObj.$description !== undefined) { currentObj.description = currentObj.$description; delete currentObj.$description; }

  // Resolve mode overrides
  const extensions = currentObj.extensions || currentObj.$extensions;
  if (mode && isPlainObject(extensions) && isPlainObject(extensions.mode)) {
      if (extensions.mode[mode] !== undefined) {
          currentObj.value = extensions.mode[mode];
          if (typeof currentObj.value === 'string') currentObj.value = normalizeReference(currentObj.value);
      }
  }
  
  if (mode && isPlainObject(currentObj.value) && currentObj.value[mode] !== undefined) {
    currentObj.value = currentObj.value[mode];
  }
  
  const isToken = currentObj.value !== undefined && currentObj.type !== undefined;

  if (isToken) {
    let finalValue = currentObj.value;
    let finalType = currentObj.type;
    let finalDescription = currentObj.description;

    // RULE: Process specific Figma scopes from extensions before they are stripped
    if (isPlainObject(extensions) && Array.isArray(extensions['com.figma.scopes'])) {
        const scopes = extensions['com.figma.scopes'] as string[];
        if (scopes.includes('GAP')) {
            finalType = 'spacing';
        } else if (scopes.includes('CORNER_RADIUS')) {
            finalType = 'borderRadius';
        } else if (scopes.includes('WIDTH_HEIGHT')) {
            finalType = 'dimension';
        } else if (scopes.includes('LINE_HEIGHT')) {
            finalType = 'lineHeight';
        } else if (scopes.includes('LETTER_SPACING')) {
            finalType = 'letterSpacing';
        } else if (scopes.includes('FONT_SIZE')) {
            finalType = 'fontSize';
        } else if (scopes.includes('FONT_FAMILY')) {
            finalType = 'fontFamily';
        } else if (scopes.includes('FONT_STYLE')) {
            const isNumeric = (typeof finalValue === 'number') || (typeof finalValue === 'string' && finalValue.trim() !== '' && !isNaN(Number(finalValue)));
            finalType = isNumeric ? 'fontWeight' : 'fontStyle';
        }
    }

    if (typeof finalValue === 'string') finalValue = normalizeReference(finalValue);

    // Contextual type overrides
    const parentKey = path.length > 1 ? path[path.length - 2] : null;
    const grandParentKey = path.length > 2 ? path[path.length - 3] : null;

    if (grandParentKey === 'font' && parentKey === 'letter-spacing' && finalType === 'number') finalType = 'letterSpacing';
    else if (grandParentKey === 'font' && parentKey === 'style' && finalType === 'string') finalType = 'fontStyle';
    
    if (finalType === 'size') finalType = 'dimension';
    if (finalType === 'number' && typeof finalValue === 'string' && finalValue.endsWith('px')) finalType = 'dimension';

    const typesThatNeedPxUnit = ['dimension', 'fontSize', 'lineHeight', 'borderRadius', 'spacing', 'letterSpacing'];
    if (typesThatNeedPxUnit.includes(finalType) && typeof finalValue === 'number') finalValue = `${finalValue}px`;

    // Handle FontFamily quoting
    if (finalType === 'fontFamily') {
        finalValue = quoteFontFamily(finalValue);
    }

    // Handle Colors - Always transform to string (Hex/RGBA)
    if (finalType === 'color' && isPlainObject(finalValue)) {
           const colorString = convertFigmaColorToString(finalValue);
           if (colorString) finalValue = colorString;
           else if (finalValue.hex) finalValue = finalValue.hex;
    }

    // Handle Composite Typography
    if ((finalType === 'typography' || finalType === 'textStyle') && isPlainObject(finalValue)) {
        const typographyValue = { ...finalValue as Record<string, any> };
        const dimensionProps = ['fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'spacing'];
        for (const prop of dimensionProps) {
            if (typographyValue[prop] !== undefined) {
                if (typeof typographyValue[prop] === 'string') typographyValue[prop] = normalizeReference(typographyValue[prop]);
                if (typeof typographyValue[prop] === 'number') typographyValue[prop] = `${typographyValue[prop]}px`;
            }
        }
        // Apply quoting to fontFamily within composite types
        if (typographyValue.fontFamily !== undefined) {
            typographyValue.fontFamily = quoteFontFamily(typographyValue.fontFamily);
        }
        finalValue = typographyValue;
    }
    
    // RETURN CLEAN TOKEN (STRICTLY REMOVE EXTENSIONS)
    const cleanToken: any = { value: finalValue, type: finalType };
    if (finalDescription) cleanToken.description = finalDescription;
    return cleanToken;

  } else {
    // Group logic (Strictly exclude extensions at group level)
    const newObj: { [key: string]: any } = {};
    for (const key in currentObj) {
      if (key === 'extensions' || key === '$extensions') continue;
      newObj[key] = traverseAndTransform(currentObj[key], options, mode, [...path, key]);
    }
    return newObj;
  }
};

export const transformJsonToStyleDictionary = (jsonString: string, options: TransformOptions = {}): Record<string, object> => {
  let parsedJson;
  try {
    parsedJson = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Invalid JSON: The file could not be parsed.');
  }

  if (!isPlainObject(parsedJson)) throw new Error('Invalid Structure: Root must be an object.');

  if (Array.isArray(parsedJson.textStyles)) {
      return { default: convertFigmaPluginExport(parsedJson) };
  }

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
};