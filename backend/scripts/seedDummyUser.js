/**
 * Seed a dummy user account into the database.
 * Usage: node scripts/seedDummyUser.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');

const DUMMY_USER = {
  name: 'logu',
  email: 'logu@vdartinc.com',
  password: 'Neela@1234',
  role: 'employee',
  department: 'IT',
  designation: 'Software Engineer',
  employeeId: 'EMP-003',
  isVerified: true,
  isActive: true,
  createdByAdmin: true,
  phone: '9876543210',
  location: {
    floor: '3rd Floor',
    branch: 'Main Office',
    city: 'Chennai'
  }
};

async function seed() {
  try {
    // Connect — uses in-memory fallback when local MongoDB isn't installed
    let mongoUri = process.env.MONGO_URI;
    if (mongoUri && mongoUri.includes('127.0.0.1')) {
      console.log('⚠️  Local MongoDB not found, using In-Memory Database...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log(`🧠 In-Memory MongoDB started at: ${mongoUri}`);
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');

    // Upsert the dummy user
    const user = await User.findOneAndUpdate(
      { email: DUMMY_USER.email },
      { $set: DUMMY_USER },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('\n✅ Dummy account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Name     : ${user.name}`);
    console.log(`  Email    : ${user.email}`);
    console.log(`  Role     : ${user.role}`);
    console.log(`  Dept     : ${user.department}`);
    console.log(`  Active   : ${user.isActive}`);
    console.log(`  Verified : ${user.isVerified}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📝 Login with OTP using email: dummy@vdartinc.com');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
