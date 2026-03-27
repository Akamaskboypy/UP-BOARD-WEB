import { SubjectData } from './types';

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
  { unit: 'Unit 1', marks: 10, chapters: ['Relations & Functions', 'Inverse Trigonometric Functions'] },
  { unit: 'Unit 2', marks: 15, chapters: ['Matrices', 'Determinants'] },
  { unit: 'Unit 3', marks: 44, chapters: ['Continuity & Differentiability', 'Applications of Derivatives', 'Integrals', 'Applications of Integrals', 'Differential Equations'] },
  { unit: 'Unit 4', marks: 18, chapters: ['Vectors', 'Three-Dimensional Geometry'] },
  { unit: 'Unit 5', marks: 5, chapters: ['Linear Programming'] },
  { unit: 'Unit 6', marks: 8, chapters: ['Probability'] },
];

export const ENG_DATA: SubjectData[] = [
  { title: 'Flamingo - Prose', marks: 15, chapters: ['The Last Lesson', 'Lost Spring', 'Deep Water', 'The Rattrap', 'Indigo', 'Poets And Pancakes', 'The Interview', 'Going Places'] },
  { title: 'Flamingo - Poetry', marks: 10, chapters: ['My Mother At Sixty-Six', 'Keeping Quiet', 'A Thing Of Beauty', 'A Roadside Stand', 'Aunt Jennifer\'s Tigers'] },
  { title: 'Vistas - Supplementary', marks: 15, chapters: ['The Third Level', 'The Tiger King', 'Journey to the End of the Earth', 'The Enemy', 'On the Face of It', 'Memories of Childhood'] },
];

export const HIN_DATA: SubjectData[] = [
  { title: 'Prose (गद्य)', chapters: ['राष्ट्र का स्वरूप', 'अशोक के फूल', 'भाषा और आधुनिकता', 'तेजस्वी मन', 'रॉबर्ट नर्सिंग होम', 'निंदा रस'] },
  { title: 'Poetry (काव्य)', chapters: ['पवन दूतिका', 'कैकेयी का अनुताप', 'श्रद्धा-मनु', 'नौका विहार', 'बापू के प्रति', 'अभिनव मनुष्य', 'मैंने आहुति बनकर देखा'] },
  { title: 'Stories (कहानी)', chapters: ['ध्रुव यात्रा', 'पंचलाइट', 'लाठी', 'बहादुर'] },
];

export const SUBJECTS = [
  { id: 'phy', label: '⚡ Physics', color: '#1e3a5f', data: PHY_DATA },
  { id: 'chem', label: '🧪 Chemistry', color: '#7b2d00', data: CHEM_DATA },
  { id: 'math', label: '📐 Maths', color: '#4a1a6b', data: MATH_DATA },
  { id: 'eng', label: '📖 English', color: '#0f766e', data: ENG_DATA },
  { id: 'hin', label: '🇮🇳 Hindi', color: '#c2410c', data: HIN_DATA },
];
