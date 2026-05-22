const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../User.model');
const Department = require('./models/Department');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    await User.deleteMany({});
    await Department.deleteMany({});

    // 1. Create Departments
    const depts = await Department.create([
      { name: 'IT Department', isActive: true },
      { name: 'HR Department', isActive: false },
      { name: 'Finance Department', isActive: false },
      { name: 'Operations Department', isActive: false }
    ]);

    const itId = depts[0]._id;
    const hrId = depts[1]._id;

    // 2. Create Users
    // Using .create() so User model pre-save hook handles bcrypt hashing
    const users = await User.create([
      {
        name: 'Super Admin',
        email: 'superadmin@vdartinc.com',
        password: 'SuperAdmin@123',
        userType: 'staff',
        role: 'super_admin',
        isApproved: true, isActive: true
      },
      {
        name: 'IT Admin',
        email: 'itadmin@vdartinc.com',
        password: 'ITAdmin@123',
        userType: 'staff',
        role: 'department_admin',
        department: itId,
        isApproved: true, isActive: true
      },
      {
        name: 'IT Agent One',
        email: 'itagent1@vdartinc.com',
        password: 'ITAgent1@123',
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_helpdesk',
        department: itId,
        shift: 'Morning',
        isApproved: true, isActive: true
      },
      {
        name: 'IT Agent Two',
        email: 'itagent2@vdartinc.com',
        password: 'ITAgent2@123',
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_support',
        department: itId,
        shift: 'Mid',
        isApproved: true, isActive: true
      },
      {
        name: 'HR Admin',
        email: 'hradmin@vdartinc.com',
        password: 'HRAdmin@123',
        userType: 'staff',
        role: 'department_admin',
        department: hrId,
        isApproved: true, isActive: true
      },
      {
        name: 'HR Agent One',
        email: 'hragent1@vdartinc.com',
        password: 'HRAgent1@123',
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_helpdesk',
        department: hrId,
        shift: 'Morning',
        isApproved: true, isActive: true
      },
      {
        name: 'HR Agent Two',
        email: 'hragent2@vdartinc.com',
        password: 'HRAgent2@123',
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_support',
        department: hrId,
        shift: 'Night',
        isApproved: true, isActive: true
      },
      { name: 'Test Employee One', email: 'employee1@vdartinc.com', password: 'Employee1@123', userType: 'employee', isApproved: true, isActive: true },
      { name: 'Test Employee Two', email: 'employee2@vdartinc.com', password: 'Employee2@123', userType: 'employee', isApproved: true, isActive: true }
    ]);

    // 3. Update Dept Admins
    await Department.findByIdAndUpdate(itId, { adminId: users[1]._id });
    await Department.findByIdAndUpdate(hrId, { adminId: users[4]._id });

    console.log("✅ Seed complete");
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();