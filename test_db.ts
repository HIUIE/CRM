import { initDb, db } from './server/db.js';

async function test() {
  try {
    await initDb();
    console.log("DB Init Success");
    const result = await db.run(
      `INSERT INTO customers (name, country, contact, logistics_preference, payment_terms, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Test', 'USA', 'Contact', '', '', 1]
    );
    console.log("Insertion Result:", result);
  } catch (err) {
    console.error("Insertion Failed:", err);
  }
}
test();
