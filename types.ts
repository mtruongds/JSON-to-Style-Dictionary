
export interface StyleDictionaryToken {
  type: 'dimension' | 'color' | 'string' | 'typography' | 'textStyle' | string;
  value: string | number | Record<string, string | number>;
  description?: string;
}
