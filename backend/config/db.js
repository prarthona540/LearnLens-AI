import mongoose from 'mongoose';

/**
 * Connect to MongoDB using the connection string defined in environment variables.
 * Exits process with failure code if initial connection cannot be established.
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables (.env)');
    }

    const conn = await mongoose.connect(mongoUri, {
      autoIndex: true,
    });

    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    console.error('[MongoDB] Ensure your MongoDB server is running or provide a valid MongoDB Atlas connection string in backend/.env');
    process.exit(1);
  }
};

// Monitor connection events after initial connection
mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Connection lost. Attempting reconnection...');
});

mongoose.connection.on('error', (err) => {
  console.error(`[MongoDB] Runtime error: ${err.message}`);
});

export default connectDB;
