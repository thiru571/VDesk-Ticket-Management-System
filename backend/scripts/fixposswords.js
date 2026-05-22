const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: '../.env' });

const User = require('../models/User.model');

async function fixPasswords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('MongoDB Connected');

    const users = await User.find().select('+password');

    for (const user of users) {

      // Skip missing passwords
      if (!user.password) {
        console.log(`⚠ No password found: ${user.email}`);
        continue;
      }

      // Skip already hashed
      if (user.password.startsWith('$2b$')) {
        console.log(`⏭ Already secured: ${user.email}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);

      user.password = hashedPassword;

      await user.save();

      console.log(`✅ Fixed password: ${user.email}`);
    }

    console.log('🎉 All passwords secured successfully');

    process.exit();

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

fixPasswords();