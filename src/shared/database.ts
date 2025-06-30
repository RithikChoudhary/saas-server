import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isIndexesCreated = false;

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Optimized connection options for memory efficiency
    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 5, // Reduced from 10 to save memory
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);

    // Create indexes only once per application lifecycle
    if (!isIndexesCreated) {
      await createIndexes();
      isIndexesCreated = true;
    }

    // Handle connection events for better memory management
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
    
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const createIndexes = async (): Promise<void> => {
  try {
    const db = mongoose.connection.db;
    
    if (!db) {
      console.warn('Database connection not available for index creation');
      return;
    }
    
    // Check if indexes already exist before creating them
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Only create indexes for existing collections to avoid memory overhead
    if (collectionNames.includes('users')) {
      await db.collection('users').createIndex({ email: 1 }, { unique: true, background: true });
      await db.collection('users').createIndex({ companyId: 1 }, { background: true });
      await db.collection('users').createIndex({ role: 1 }, { background: true });
    }
    
    if (collectionNames.includes('companies')) {
      await db.collection('companies').createIndex({ domain: 1 }, { unique: true, background: true });
      await db.collection('companies').createIndex({ 'subscription.status': 1 }, { background: true });
    }
    
    if (collectionNames.includes('companyapps')) {
      await db.collection('companyapps').createIndex({ companyId: 1, appId: 1 }, { unique: true, background: true });
      await db.collection('companyapps').createIndex({ companyId: 1 }, { background: true });
    }
    
    if (collectionNames.includes('userappaccesses')) {
      await db.collection('userappaccesses').createIndex({ userId: 1, appId: 1 }, { background: true });
      await db.collection('userappaccesses').createIndex({ userId: 1 }, { background: true });
    }
    
    if (collectionNames.includes('sessions')) {
      await db.collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0, background: true });
    }
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
};

// Graceful shutdown function
export const closeDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
};

export default connectDB;
