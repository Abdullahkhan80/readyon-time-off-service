const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('Tables:', tables);

  db.all("SELECT count(*) as count FROM employees;", (err, rows) => {
    if (!err) console.log('Employees count:', rows[0].count);
    else console.error('Employees table error:', err.message);
  });

  db.all("SELECT count(*) as count FROM time_off_balances;", (err, rows) => {
    if (!err) console.log('Balances count:', rows[0].count);
    else console.error('Balances table error:', err.message);
  });

  db.all("SELECT * FROM employees;", (err, rows) => {
    if (!err) console.log('Employees:', rows);
  });

  db.all("SELECT * FROM time_off_balances;", (err, rows) => {
    if (!err) console.log('Balances:', rows);
  });

  setTimeout(() => db.close(), 1000);
});
