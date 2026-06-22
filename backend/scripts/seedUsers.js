require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User.model');

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected");

    // ---------- ADMIN ----------
    const admin = {
      name: "System Administrator",
      email: "admin@vdartinc.com",
      password: "Admin@123",
      role: "admin",
      department: "IT",
      designation: "System Administrator",
      employeeId: "ADMIN-001",
      isVerified: true,
      isActive: true,
      createdByAdmin: true,
      phone: "9999999999"
    };

    // ---------- SUPPORT AGENTS ----------
    const agents = [
      {
        name: "Naveen",
        email: "agent1@vdartinc.com",
        password: "Agent@123",
        role: "support_agent",
        department: "IT",
        designation: "Support Agent",
        employeeId: "AGENT-002",
        isVerified: true,
        isActive: true,
        createdByAdmin: true,
        phone: "9000000001"
      },
      {
        name: "Rahul",
        email: "agent2@vdartinc.com",
        password: "Agent@123",
        role: "support_agent",
        department: "IT",
        designation: "Support Agent",
        employeeId: "AGENT-003",
        isVerified: true,
        isActive: true,
        createdByAdmin: true,
        phone: "9000000002"
      },
      {
        name: "Priya",
        email: "agent3@vdartinc.com",
        password: "Agent@123",
        role: "support_agent",
        department: "IT",
        designation: "Support Agent",
        employeeId: "AGENT-004",
        isVerified: true,
        isActive: true,
        createdByAdmin: true,
        phone: "9000000003"
      }
    ];

    // ---------- EMPLOYEES ----------
    const employees = [];

    for (let i = 1; i <= 10; i++) {

      employees.push({
        name: `Employee ${i}`,
        email: `emp${i}@vdartinc.com`,
        password: "Employee@123",
        role: "employee",
        department: "IT",
        designation: "Software Engineer",
        employeeId: `EMP-00${i}`,
        isVerified: true,
        isActive: true,
        createdByAdmin: true,
        phone: `98765432${String(i).padStart(2,'0')}`
      });

    }

    const users = [admin, ...agents, ...employees];

    for (const user of users) {

      const exists = await User.findOne({ email: user.email });

      if (!exists) {
        await User.create(user);
        console.log("✅ Created:", user.email);
      } else {
        console.log("⚠ Already Exists:", user.email);
      }

    }

    console.log("\n🎉 Users Seeded Successfully");

    process.exit();

  } catch (err) {

    console.log(err);

    process.exit(1);

  }

}

seedUsers();