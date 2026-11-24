export type ThemeSetting = 'system' | 'dark' | 'light';
export type LangCode = 'uk' | 'ru' | 'en';

export interface Settings {
  base: string;
  haptic: boolean;
  demoOff: boolean;
  opening: number;
  theme?: ThemeSetting;
  lang?: LangCode;
}
