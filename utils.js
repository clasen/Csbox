import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'crypto';

export const importCsv = async (filePath, db) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'File not found' };
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  let count = 0;
  for (const record of records) {
    // Create a unique ID for each record
    const id = randomUUID();
    // Store in DB
    // db.set(path, value) -> we'll store under 'accounts/id'
    await db.set(`accounts.${id}`, {
        id,
        ...record,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
    count++;
  }
  
  return { success: true, count };
};

export const searchAccounts = async (db, query) => {
    const accounts = (await db.get('accounts')) || {};
    if (!query) return Object.values(accounts);
    
    const lowerQuery = query.toLowerCase();
    return Object.values(accounts).filter(acc => {
        return (acc.title && acc.title.toLowerCase().includes(lowerQuery)) ||
               (acc.website && acc.website.toLowerCase().includes(lowerQuery)) ||
               (acc.login && acc.login.toLowerCase().includes(lowerQuery)) ||
               (acc.notes && acc.notes.toLowerCase().includes(lowerQuery));
    });
};
