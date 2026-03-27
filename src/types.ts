export interface Chapter {
  name: string;
}

export interface SubjectData {
  sec?: string;
  unit?: string;
  title?: string;
  marks?: number;
  branch?: 'Physical' | 'Inorganic' | 'Organic';
  chapters: string[];
}

export type SubjectCode = 'phy' | 'chem' | 'math' | 'eng' | 'hin';

export interface ProgressState {
  [key: string]: boolean;
}
