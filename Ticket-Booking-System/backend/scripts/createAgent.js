require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');

async function createAgent() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    const existing = await User.findOne({ email: 'naveen@vdartinc.com' });
    if (existing) {
      console.log('⚠️  User already exists:', existing.email, '| Role:', existing.role);
      await mongoose.disconnect();
      return;
    }

    const agent = await User.create({
      name: 'Naveen',
      email: 'naveen@vdartinc.com',
      password: 'Naveen@123',
      role: 'support_agent',
      department: 'IT',
      expertise: ['IT'],
      isActive: true,
      isVerified: true,
      designation: 'Support Agent',
      liveStatus: 'available'
    });

    console.log('✅ Support Agent created successfully!');
    console.log('   Name    :', agent.name);
    console.log('   Email   :', agent.email);
    console.log('   Role    :', agent.role);
    console.log('   Password: Naveen@123');

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createAgent();
