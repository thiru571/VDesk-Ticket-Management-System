const mongoose = require('mongoose');
const User = require('../models/User.model');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ansaris:Ansarims%40%2123%23@cluster0.atbl7to.mongodb.net/TICKET_BOOKING';

async function grantAccess() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const email = 'krusanth22@vdartinc.com';
    let user = await User.findOne({ email });

    if (user) {
      user.role = 'support_agent';
      user.isVerified = true;
      user.isActive = true;
      await user.save();
      console.log(`Updated user ${email} to support_agent`);
    } else {
      user = await User.create({
        name: 'Krusanth',
        email,
        role: 'support_agent',
        password: 'Password@123', // Default password
        isVerified: true,
        isActive: true,
        department: 'IT'
      });
      console.log(`Created new support_agent: ${email}`);
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

grantAccess();
