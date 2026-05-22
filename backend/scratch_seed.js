const mongoose = require('mongoose');
const connectDB = require('./config/database');
const seedKnowledgeBase = require('./scripts/seedKnowledge');
require('dotenv').config();

const run = async () => {
  try {
    await connectDB();
    await seedKnowledgeBase();
    console.log('Seeding complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
