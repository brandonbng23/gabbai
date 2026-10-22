export const userTitles = ['Mr.', 'Mrs.', 'Ms.', 'Mx.', 'Dr.', 'Rabbi', 'Chazzan', 'Rebbetzin'] as const;

export type UserTitle = typeof userTitles[number];
