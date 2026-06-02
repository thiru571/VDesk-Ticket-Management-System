const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Settings = require('./models/Settings.model');

const test = async () => {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');
    
    const settings = await Settings.find();
    console.log('Settings found:', settings.length);
    console.log(settings);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

test();
