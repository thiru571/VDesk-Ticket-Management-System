const mongoose = require('mongoose');
const connectDB = require('./config/database');
const KnowledgeBase = require('./models/KnowledgeBase.model');
require('dotenv').config();

const check = async () => {
  try {
    await connectDB();
    const article = await KnowledgeBase.findOne({ steps: { $exists: true } });
    if (article) {
      console.log(`✅ Found article with steps: ${article.title}`);
      console.log(JSON.stringify(article.steps, null, 2));
    } else {
      console.log('❌ No articles found with steps.');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

check();
