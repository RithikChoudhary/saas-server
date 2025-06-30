import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB, { closeDatabase } from './shared/database';
import { authRoutes } from './features/auth';
import { appsRoutes } from './features/apps';
import { usersRoutes } from './features/users';
import { syncRoutes, realSyncRoutes } from './features/integrations';
import { companiesRoutes } from './features/companies';
import awsRoutes from './features/integrations/aws/routes/aws.routes';
import azureRoutes from './features/integrations/azure/routes/azure.routes';
import githubRoutes from './features/integrations/github/routes/github.routes';
import slackRoutes from './features/integrations/slack/routes/slack.routes';
import zoomRoutes from './features/integrations/zoom/routes/zoom.routes';
import googleWorkspaceRoutes from './features/integrations/google-workspace/routes/google-workspace.routes';
import dashboardRoutes from './features/dashboard/routes/dashboard.routes';
import credentialsRoutes from './features/credentials/routes/credentials.routes';
import { analyticsRoutes } from './features/analytics';
import { seedApps } from './shared/utils/seedApps';
import { 
  getMemoryStats, 
  logMemoryUsage, 
  memoryOptimizationMiddleware,
  startMemoryCleanup,
  getMemoryReport
} from './shared/utils/memoryMonitor';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB and seed initial data
connectDB().then(() => {
  // Seed apps after database connection
  seedApps().catch(console.error);
});


// Security middleware
app.use(helmet());

// CORS configuration
import { getCorsOrigins, logEnvironmentConfig } from './shared/utils/environmentConfig';

app.use(cors({
  origin: getCorsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Body parsing middleware with reduced limits for memory efficiency
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Memory optimization middleware
app.use(memoryOptimizationMiddleware);

// Request timeout middleware to prevent memory leaks
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    res.status(408).json({
      success: false,
      message: 'Request timeout'
    });
  });
  next();
});

// Health check endpoint with memory stats
app.get('/health', (req, res) => {
  const memoryStats = getMemoryStats();
  res.json({
    success: true,
    message: 'SaaS Management Platform API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      heapUsed: `${memoryStats.heapUsedMB}MB`,
      heapTotal: `${memoryStats.heapTotalMB}MB`,
      rss: `${memoryStats.rssMB}MB`,
      external: `${memoryStats.externalMB}MB`
    },
    uptime: `${Math.floor(process.uptime())}s`
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'SaaS Management Platform API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      apps: '/api/apps',
      webhooks: '/api/webhooks'
    },
    documentation: 'See README.md for complete API documentation'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({
    success: true,
    message: 'Test endpoint working',
    timestamp: new Date().toISOString()
  });
});

// Memory report endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/memory-report', (req, res) => {
    res.json({
      success: true,
      report: getMemoryReport()
    });
  });
}

// Simple registration test endpoint
app.post('/api/test-register', async (req, res) => {
  try {
    console.log('Test registration endpoint hit with body:', req.body);
    res.json({
      success: true,
      message: 'Test registration endpoint working',
      receivedData: req.body
    });
  } catch (error) {
    console.error('Test registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Test registration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/apps', appsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/real-sync', realSyncRoutes);
app.use('/api/company', companiesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/integrations/aws', awsRoutes);
app.use('/api/integrations/azure', azureRoutes);
app.use('/api/integrations/github', githubRoutes);
app.use('/api/integrations/slack', slackRoutes);
app.use('/api/integrations/zoom', zoomRoutes);
app.use('/api/integrations/google-workspace', googleWorkspaceRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Start server 
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  logEnvironmentConfig();
  logMemoryUsage('💾 Initial memory usage');
  
  // Start periodic memory cleanup
  startMemoryCleanup(5); // Run cleanup every 5 minutes
  console.log('🧹 Periodic memory cleanup started (every 5 minutes)');
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      // Close database connection
      await closeDatabase();
      console.log('Database connection closed');
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Memory monitoring (optional - for debugging)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    logMemoryUsage('🔍 Memory check');
  }, 60000); // Log every minute
}

export default app;
