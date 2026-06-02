const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: '../.env' });

const User = require('../models/User.model');

async function repairUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('MongoDB Connected');

    const user = await User.findOne({
      email: 'neela@vdartinc.com'
    }).select('+password');

    if (!user) {
      console.log('User not found');
      process.exit();
    }

    const hashedPassword = await bcrypt.hash('Neela@1234', 10);

    user.password = hashedPassword;

    await user.save();

    console.log('✅ Password repaired successfully');

    process.exit();

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

repairUser();