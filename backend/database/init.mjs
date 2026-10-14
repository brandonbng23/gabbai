import { openDatabase } from './index.mjs';

const database = openDatabase();
console.log(`Database initialized: ${database.path}`);
database.close();
