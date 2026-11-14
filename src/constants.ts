import { SubjectData, SubjectCode } from './types';

export const PHY_DATA: SubjectData[] = [
  { sec: 'Section A (35 Marks)', unit: 'Unit 1 — Electrostatics', marks: 8, chapters: ['Electric Charges & Fields', 'Electrostatic Potential & Capacitance'] },
  { sec: '', unit: 'Unit 2 — Current Electricity', marks: 7, chapters: ['Current Electricity'] },
  { sec: '', unit: 'Unit 3 — Magnetic Effects of Current & Magnetism', marks: 8, chapters: ['Moving Charges & Magnetism', 'Magnetism & Matter'] },
  { sec: '', unit: 'Unit 4 — Electromagnetic Induction & AC', marks: 8, chapters: ['Electromagnetic Induction', 'Alternating Current'] },
  { sec: '', unit: 'Unit 5 — Electromagnetic Waves', marks: 4, chapters: ['Electromagnetic Waves'] },
  { sec: 'Section B (35 Marks)', unit: 'Unit 6 — Optics', marks: 13, chapters: ['Ray Optics & Optical Instruments', 'Wave Optics'] },
  { sec: '', unit: 'Unit 7 — Dual Nature', marks: 6, chapters: ['Dual Nature of Radiation & Matter'] },
  { sec: '', unit: 'Unit 8 — Atoms & Nuclei', marks: 8, chapters: ['Atoms', 'Nuclei'] },
  { sec: '', unit: 'Unit 9 — Electronic Devices', marks: 8, chapters: ['Semiconductor Electronics'] },
];

export const CHEM_DATA: SubjectData[] = [
  { unit: 'Unit 1', marks: 8, branch: 'Physical', chapters: ['Solutions'] },
  { unit: 'Unit 2', marks: 7, branch: 'Physical', chapters: ['Electrochemistry'] },
  { unit: 'Unit 3', marks: 7, branch: 'Physical', chapters: ['Chemical Kinetics'] },
  { unit: 'Unit 4', marks: 6, branch: 'Inorganic', chapters: ['The d- and f-Block Elements'] },
  { unit: 'Unit 5', marks: 7, branch: 'Inorganic', chapters: ['Coordination Compounds'] },
  { unit: 'Unit 6', marks: 7, branch: 'Organic', chapters: ['Haloalkanes & Haloarenes'] },
  { unit: 'Unit 7', marks: 7, branch: 'Organic', chapters: ['Alcohols, Phenols & Ethers'] },
  { unit: 'Unit 8', marks: 8, branch: 'Organic', chapters: ['Aldehydes, Ketones & Carboxylic Acids'] },
  { unit: 'Unit 9', marks: 6, branch: 'Organic', chapters: ['Amines'] },
  { unit: 'Unit 10', marks: 7, branch: 'Organic', chapters: ['Biomolecules'] },
];

export const MATH_DATA: SubjectData[] = [
  { unit: 'Unit 1 — Relations and Functions', marks: 10, chapters: ['Relations & Functions', 'Inverse Trigonometric Functions'] },
  { unit: 'Unit 2 — Algebra', marks: 15, chapters: ['Matrices', 'Determinants'] },
  { unit: 'Unit 3 — Calculus', marks: 44, chapters: ['Continuity & Differentiability', 'Applications of Derivatives', 'Integrals', 'Applications of Integrals', 'Differential Equations'] },
  { unit: 'Unit 4 — Vectors and Three-Dimensional Geometry', marks: 18, chapters: ['Vectors', 'Three-Dimensional Geometry'] },
  { unit: 'Unit 5 — Linear Programming', marks: 5, chapters: ['Linear Programming'] },
  { unit: 'Unit 6 — Probability', marks: 8, chapters: ['Probability'] },
];

export const ENG_DATA: SubjectData[] = [
  { title: 'Flamingo - Prose', marks: 15, chapters: ['The Last Lesson', 'Lost Spring', 'Deep Water', 'The Rattrap', 'Indigo', 'Poets And Pancakes', 'The Interview', 'Going Places'] },
  { title: 'Flamingo - Poetry', marks: 10, chapters: ['My Mother At Sixty-Six', 'Keeping Quiet', 'A Thing Of Beauty', 'A Roadside Stand', 'Aunt Jennifer\'s Tigers'] },
  { title: 'Vistas - Supplementary', marks: 15, chapters: ['The Third Level', 'The Tiger King', 'Journey to the End of the Earth', 'The Enemy', 'On the Face of It', 'Memories of Childhood'] },
  { title: 'Section A - Reading', marks: 15, chapters: ['Unseen Passage'] },
  { title: 'Section B - Writing', marks: 20, chapters: ['Article Writing', 'Letter Writing'] },
  { title: 'Section C - Grammar', marks: 25, chapters: ['Direct & Indirect', 'Synthesis', 'Transformation', 'Syntax', 'Idioms & Phrases', 'Synonyms', 'Antonyms', 'One Word Substitution', 'Homophones', 'Translation (Hindi to English)'] },
];

export const HIN_DATA: SubjectData[] = [
  { title: 'Prose (गद्य)', marks: 10, chapters: ['राष्ट्र का स्वरूप', 'अशोक के फूल', 'भाषा और आधुनिकता', 'तेजस्वी मन', 'रॉबर्ट नर्सिंग होम', 'निंदा रस'] },
  { title: 'Poetry (काव्य)', marks: 10, chapters: ['पवन दूतिका', 'कैकेयी का अनुताप', 'श्रद्धा-मनु', 'नौका विहार', 'बापू के प्रति', 'अभिनव मनुष्य', 'मैंने आहुति बनकर देखा'] },
  { title: 'Biographies (जीवन परिचय)', marks: 10, chapters: ['लेखक (Prose Writers)', 'कवि (Poets)'] },
  { title: 'Stories (कहानी)', marks: 5, chapters: ['ध्रुव यात्रा', 'पंचलाइट', 'लाठी', 'बहादुर'] },
  { title: 'Khandkavya (खंडकाव्य)', marks: 5, chapters: ['मुक्ति यज्ञ', 'सत्य की जीत', 'रश्मिरथी', 'आलोक वृत्त', 'त्यागपथी', 'श्रवण कुमार'] },
  { title: 'Sanskrit (संस्कृत दिगदर्शिका)', marks: 14, chapters: ['भोजस्यौदार्यम्', 'आत्मज्ञ एवं सर्वज्ञ', 'संस्कृतभाषाया: महत्त्वम्', 'जातक कथा', 'सुभाषितरत्नानि', 'महामना मालवीय:', 'पञ्चशील-सिद्धान्ता:'] },
];

export interface SubjectConfig {
  id: SubjectCode;
  name: string;
  code: string;
  label: string;
  paperType: string;
  lightAccent: string;
  darkAccent: string;
  color: string;
  data: SubjectData[];
}

export const SUBJECTS: SubjectConfig[] = [
  {
    id: 'phy',
    name: 'Physics',
    code: 'PHY-101',
    label: 'Physics',
    paperType: '70 Marks Theory + 30 Practical',
    lightAccent: '#2563EB',
    darkAccent: '#60A5FA',
    color: '#2563EB',
    data: PHY_DATA,
  },
  {
    id: 'chem',
    name: 'Chemistry',
    code: 'CHE-102',
    label: 'Chemistry',
    paperType: '70 Marks Theory + 30 Practical',
    lightAccent: '#D97706',
    darkAccent: '#FBBF24',
    color: '#D97706',
    data: CHEM_DATA,
  },
  {
    id: 'math',
    name: 'Mathematics',
    code: 'MAT-103',
    label: 'Mathematics',
    paperType: '100 Marks Written Paper',
    lightAccent: '#7C3AED',
    darkAccent: '#A78BFA',
    color: '#7C3AED',
    data: MATH_DATA,
  },
  {
    id: 'eng',
    name: 'English',
    code: 'ENG-104',
    label: 'English',
    paperType: '100 Marks Literature & Language',
    lightAccent: '#0D9488',
    darkAccent: '#2DD4BF',
    color: '#0D9488',
    data: ENG_DATA,
  },
  {
    id: 'hin',
    name: 'Hindi',
    code: 'HIN-105',
    label: 'Hindi',
    paperType: 'Syllabus Core Sections (54 Marks)',
    lightAccent: '#E11D48',
    darkAccent: '#FB7185',
    color: '#E11D48',
    data: HIN_DATA,
  },
];
