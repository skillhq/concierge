// kleur color function type
export type ColorFn = (text: string | number) => string;

export interface CliColors {
  primary: ColorFn;
  secondary: ColorFn;
  success: ColorFn;
  error: ColorFn;
  warning: ColorFn;
  info: ColorFn;
  muted: ColorFn;
  highlight: ColorFn;
}

export interface CliContext {
  colors: CliColors;
  json: boolean;
  verbose: boolean;
}

export type OutputMode = 'text' | 'json';
