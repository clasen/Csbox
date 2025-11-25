#!/usr/bin/env node
import Persist from './persist.js';
import { AppUI } from './ui.js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';

const DB_PATH = path.join(os.homedir(), '.cryptop');
const DB_FILE = path.join(DB_PATH, 'db.json');

// Ensure the .cryptop directory exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

const readPassword = async (prompt) => {
  process.stdout.write(prompt);
  
  let password = '';
  
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  
  await new Promise(resolve => {
    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.removeListener('data', onData);
            if (process.stdin.setRawMode) {
              process.stdin.setRawMode(false);
            }
            process.stdin.pause();
            process.stdout.write('\n');
            resolve();
            return; 
          case '\u0003': // Ctrl+C
            if (process.stdin.setRawMode) {
              process.stdin.setRawMode(false);
            }
            process.exit();
            break;
          case '\u007f': // Backspace
          case '\b':
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            if (char.charCodeAt(0) >= 32) {
              password += char;
              process.stdout.write('*');
            }
            break;
        }
      }
    };
    process.stdin.on('data', onData);
  });

  return password;
};

const getPassword = async (isFirstTime) => {
  if (isFirstTime) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️  First time setup - Creating new encrypted database');
    
    while (true) {
      const password1 = await readPassword('Enter Master Password: ');
      if (!password1) {
        console.error('Password required.');
        process.exit(1);
      }
      
      const password2 = await readPassword('Confirm Master Password: ');
      
      if (password1 === password2) {
        console.log('\x1b[32m%s\x1b[0m', '✓ Passwords match!');
        return password1;
      } else {
        console.log('\x1b[31m%s\x1b[0m', '✗ Passwords do not match. Please try again.\n');
      }
    }
  } else {
    const password = await readPassword('Password: ');
    if (!password) {
      console.error('Password required.');
      process.exit(1);
    }
    return password;
  }
};

const importCSV = async (csvPath, password) => {
  if (!fs.existsSync(csvPath)) {
    console.error('Error: CSV file not found:', csvPath);
    process.exit(1);
  }

  console.log('Reading CSV...');
  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Found ${records.length} records. Preparing to save...`);

  const accountsMap = {};
  for (const record of records) {
    const id = randomUUID();
    const now = new Date().toISOString();
    accountsMap[id] = {
      id,
      ...record,
      created_at: now,
      updated_at: now
    };
  }

  const db = new Persist({ 
    encryptionKey: password,
    name: 'db',
    path: DB_PATH
  });

  console.log('Encrypting and saving to database...');
  try {
    await db.set('accounts', accountsMap);
    console.log('\x1b[32m%s\x1b[0m', `✓ Success! Database created at ${DB_FILE}`);
    console.log('\x1b[32m%s\x1b[0m', `✓ Imported ${records.length} accounts`);
    process.exit(0);
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Error saving database:', err);
    process.exit(1);
  }
};

const start = async () => {
  // Check if CSV import is requested
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const csvPath = args[0];
    if (csvPath.endsWith('.csv')) {
      console.log('\x1b[36m%s\x1b[0m', 'Cryptop CSV Importer');
      
      // Check if database already exists
      const isFirstTime = !fs.existsSync(DB_FILE);
      
      const password = await getPassword(isFirstTime);
      await importCSV(csvPath, password);
      return;
    }
  }

  // Normal startup - launch UI
  // Ensure we start fresh with terminal
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', 'Welcome to Cryptop');
  
  // Check if database already exists
  const isFirstTime = !fs.existsSync(DB_FILE);
  
  const password = await getPassword(isFirstTime);

  try {
    // Use home directory for DB
    const db = new Persist({ 
      encryptionKey: password,
      name: 'db',
      path: DB_PATH
    });
    
    try {
        // Verify DB access
        const accounts = await db.get('accounts');
        // We don't throw if empty, just if decryption fails (wrong password)
    } catch (e) {
        if (e.message === 'INVALID_PASSWORD') {
          console.error('\x1b[31m%s\x1b[0m', '\n✗ Error: Incorrect password');
        } else {
          console.error('\x1b[31m%s\x1b[0m', '\n✗ Error: Invalid password or corrupted database');
          console.error(e.message);
        }
        process.exit(1);
    }

    // Initialize UI
    // Removed auto-import logic path
    const app = new AppUI(db);
    
  } catch (err) {
    // Handle errors during Persist initialization
    if (err.message === 'INVALID_PASSWORD') {
      console.error('\x1b[31m%s\x1b[0m', '\n✗ Error: Incorrect password');
    } else {
      console.error('\x1b[31m%s\x1b[0m', '\n✗ Initialization error:', err.message);
    }
    process.exit(1);
  }
};

start();
