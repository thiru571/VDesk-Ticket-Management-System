const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Get or Create Support Agents
    let agents = await User.find({ role: 'support_agent' });
    if (agents.length === 0) {
      console.log('Creating dummy agents...');
      const dummyAgents = [
        { name: 'Sarah Miller', email: 'sarah.m@vdesk.com', role: 'support_agent', department: 'IT', password: 'Password123!', isVerified: true, isActive: true },
        { name: 'James Wilson', email: 'james.w@vdesk.com', role: 'support_agent', department: 'IT', password: 'Password123!', isVerified: true, isActive: true },
        { name: 'Anita Rao', email: 'anita.r@vdesk.com', role: 'support_agent', department: 'HR', password: 'Password123!', isVerified: true, isActive: true },
        { name: 'Kevin Chen', email: 'kevin.c@vdesk.com', role: 'support_agent', department: 'Finance', password: 'Password123!', isVerified: true, isActive: true }
      ];
      agents = await User.insertMany(dummyAgents);
    }

    const admin = await User.findOne({ role: 'admin' });
    const userId = admin ? admin._id : agents[0]._id;

    // 2. Clear old dummy tickets (Optional - but let's just add new ones)
    // await Ticket.deleteMany({ title: { $regex: 'Dummy:' } });

    console.log('Seeding dummy tickets...');
    const categories = ['IT', 'HR', 'Network', 'Software', 'Hardware', 'Request', 'Replacement'];
    const priorities = ['low', 'medium', 'high', 'critical'];
    const statuses   = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];
    const offices    = ['GICC', 'Bangalore'];

    const tickets = [];
    const now = new Date();

    for (let i = 0; i < 150; i++) {
      const daysAgo = Math.floor(Math.random() * 45); // Spread over 45 days
      const createdAt = new Date(now);
      createdAt.setDate(now.getDate() - daysAgo);
      createdAt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      const agentIdx = Math.floor(Math.random() * agents.length);
      const assignedTo = status === 'open' ? null : agents[agentIdx]._id;

      let resolvedAt = null;
      let resolution = null;
      let feedback = null;

      if (['resolved', 'closed'].includes(status)) {
        resolvedAt = new Date(createdAt);
        const resolutionHours = Math.floor(Math.random() * 48) + 2;
        resolvedAt.setHours(resolvedAt.getHours() + resolutionHours);
        
        resolution = {
          notes: 'Standard resolution applied. Issue verified and closed.',
          type: ['remote_fix', 'on_site_fix', 'guided_employee'][Math.floor(Math.random() * 3)],
          resolvedAt: resolvedAt,
          resolvedBy: assignedTo
        };

        if (Math.random() > 0.3) {
          feedback = {
            rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars
            comment: ['Good service', 'Very fast!', 'Helpful agent', 'Fixed my issue quickly'][Math.floor(Math.random() * 4)],
            submittedAt: new Date(resolvedAt.getTime() + 3600000)
          };
        }
      }

      tickets.push({
        ticketId: `TKT-${10000 + i}`,
        title: `Dummy: ${category} issue - ${priority} priority`,
        description: `This is a generated dummy ticket for analytics testing. Related to ${category} in ${offices[i % 2]}.`,
        category,
        priority,
        status,
        createdAt,
        updatedAt: status === 'resolved' ? resolvedAt : createdAt,
        createdBy: userId,
        assignedTo,
        office: offices[Math.floor(Math.random() * 2)],
        sla: {
          deadline: new Date(createdAt.getTime() + 86400000 * 2),
          breached: Math.random() > 0.8 && status !== 'resolved'
        },
        resolution,
        feedback,
        reopenCount: Math.random() > 0.9 ? 1 : 0
      });
    }

    await Ticket.insertMany(tickets);
    console.log(`Successfully seeded ${tickets.length} tickets.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
