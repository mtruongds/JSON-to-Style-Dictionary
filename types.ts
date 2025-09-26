
export interface StyleDictionaryToken {
  type: 'dimension' | 'color' | 'string' | string;
  value: string | number;
  description?: string;
}
