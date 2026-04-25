const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

const employeeId = '123e4567-e89b-12d3-a456-426614174000';
const locationId = 'NY';
const balance = 160;

db.serialize(() => {
  db.run(`INSERT OR IGNORE INTO employees (id, firstName, lastName, email) 
          VALUES (?, 'John', 'Doe', 'john.doe@example.com')`, [employeeId]);
  
  db.run(`INSERT OR IGNORE INTO time_off_balances (id, employeeId, locationId, balance, reservedBalance, type, version) 
          VALUES (?, ?, ?, ?, 0, 'PTO', 1)`, 
          ['b1-' + Date.now(), employeeId, locationId, balance]);
});

db.close();
console.log('Seeded employee and balance.');
