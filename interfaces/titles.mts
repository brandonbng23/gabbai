export const userTitles = ['Mr.', 'Mrs.', 'Ms.', 'Mx.', 'Dr.', 'Rabbi', 'Chazan', 'Rebbetzin'] as const;

export type UserTitle = typeof userTitles[number];
