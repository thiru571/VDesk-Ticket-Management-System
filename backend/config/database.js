const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in .env');
    }

    // ── In-Memory fallback (dev only, data resets on restart) ─────────────────
    // Only kicks in when MONGO_URI explicitly points to localhost/127.0.0.1
    // For real persistence use MongoDB Atlas (see .env.example)
    const isLocal =
      mongoUri.includes('127.0.0.1') || mongoUri.includes('localhost');

    if (isLocal) {
      console.log('⚠️  Local URI detected — trying mongodb-memory-server...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        mongoUri = mongoServer.getUri();
        console.log('🧠 In-Memory MongoDB started (data will NOT persist across restarts)');
        console.log('💡 For persistent data, set MONGO_URI to a MongoDB Atlas connection string in .env');
      } catch (err) {
        console.warn('⚠️  mongodb-memory-server unavailable:', err.message);
      }
    }

    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser:    true,
      useUnifiedTopology: true,
    });

    const isAtlas = conn.connection.host.includes('mongodb.net');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    if (isAtlas) {
      console.log('☁️  Using MongoDB Atlas — data will persist across restarts');
    }

  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconnected');
});

module.exports = connectDB;