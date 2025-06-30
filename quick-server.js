const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Body parsing middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health endpoint hit');
  res.json({
    success: true,
    message: 'SaaS Management Platform API is running',
    timestamp: new Date().toISOString(),
    environment: 'development'
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

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('Login endpoint hit with body:', req.body);
  
  // Simple test response with correct token structure
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: '1',
        email: req.body.email,
        firstName: 'Test',
        lastName: 'User'
      },
      tokens: {
        accessToken: 'test-access-token-' + Date.now(),
        refreshToken: 'test-refresh-token-' + Date.now()
      }
    }
  });
});

// Dashboard endpoint
app.get('/api/dashboard/overview', (req, res) => {
  console.log('Dashboard overview endpoint hit');
  res.json({
    success: true,
    data: {
      connectedServices: 2,
      totalUsers: 26,
      totalAccounts: 2,
      monthlyCost: 150,
      totalResources: 84,
      securityScore: 85,
      services: [
        {
          type: 'github',
          name: 'GitHub',
          accounts: 1,
          users: 26,
          cost: 50,
          status: 'connected'
        },
        {
          type: 'aws',
          name: 'Amazon Web Services',
          accounts: 1,
          users: 0,
          cost: 100,
          status: 'connected'
        }
      ],
      lastUpdated: new Date().toISOString()
    }
  });
});

// Credentials endpoint
app.get('/api/credentials', (req, res) => {
  console.log('Credentials endpoint hit');
  res.json({
    success: true,
    data: [
      {
        id: '1',
        appType: 'github',
        appName: 'GitHub Production',
        isActive: true,
        createdAt: new Date().toISOString(),
        hasCredentials: true,
        connectionStatus: {
          isConnected: true,
          lastSync: new Date().toISOString(),
          requiresOAuth: false,
          connectionDetails: {
            username: 'testuser',
            organization: 'Trans-Fi'
          }
        }
      },
      {
        id: '2',
        appType: 'aws',
        appName: 'AWS Production',
        isActive: true,
        createdAt: new Date().toISOString(),
        hasCredentials: true,
        connectionStatus: {
          isConnected: true,
          lastSync: new Date().toISOString(),
          requiresOAuth: false,
          connectionDetails: {
            accountId: '123456789012',
            region: 'us-east-1'
          }
        }
      }
    ]
  });
});

// GitHub users endpoint
app.get('/api/integrations/github/users', (req, res) => {
  console.log('GitHub users endpoint hit');
  res.json({
    success: true,
    data: {
      users: [
        { id: 1, login: 'user1', name: 'User One', email: 'user1@example.com' },
        { id: 2, login: 'user2', name: 'User Two', email: 'user2@example.com' },
        { id: 3, login: 'user3', name: 'User Three', email: 'user3@example.com' }
      ],
      totalCount: 26,
      page: 1,
      totalPages: 9
    }
  });
});

// AWS users endpoint
app.get('/api/integrations/aws/users', (req, res) => {
  console.log('AWS users endpoint hit');
  res.json({
    success: true,
    data: {
      users: [
        { id: 1, username: 'admin', name: 'Administrator', email: 'admin@company.com' },
        { id: 2, username: 'developer', name: 'Developer User', email: 'dev@company.com' }
      ],
      totalCount: 2,
      page: 1,
      totalPages: 1
    }
  });
});

// AWS IAM users endpoint (for the AWS Users page)
app.get('/api/integrations/aws/iam/users', (req, res) => {
  console.log('AWS IAM users endpoint hit');
  res.json({
    success: true,
    data: [
      {
        id: '1',
        userName: 'admin-user',
        email: 'admin@company.com',
        arn: 'arn:aws:iam::123456789012:user/admin-user',
        createDate: '2024-01-15T10:30:00Z',
        lastActivity: '2025-06-30T15:45:00Z',
        status: 'active',
        groups: ['Administrators', 'PowerUsers'],
        policies: ['AdministratorAccess'],
        accessKeys: 2,
        mfaEnabled: true,
        accountId: '123456789012',
        accountName: 'Production Account'
      },
      {
        id: '2',
        userName: 'developer-user',
        email: 'dev@company.com',
        arn: 'arn:aws:iam::123456789012:user/developer-user',
        createDate: '2024-02-20T14:20:00Z',
        lastActivity: '2025-06-29T09:15:00Z',
        status: 'active',
        groups: ['Developers'],
        policies: ['PowerUserAccess'],
        accessKeys: 1,
        mfaEnabled: true,
        accountId: '123456789012',
        accountName: 'Production Account'
      },
      {
        id: '3',
        userName: 'readonly-user',
        email: 'readonly@company.com',
        arn: 'arn:aws:iam::123456789012:user/readonly-user',
        createDate: '2024-03-10T11:00:00Z',
        lastActivity: '2025-06-28T16:30:00Z',
        status: 'active',
        groups: ['ReadOnly'],
        policies: ['ReadOnlyAccess'],
        accessKeys: 1,
        mfaEnabled: false,
        accountId: '123456789012',
        accountName: 'Production Account'
      },
      {
        id: '4',
        userName: 'inactive-user',
        email: 'inactive@company.com',
        arn: 'arn:aws:iam::123456789012:user/inactive-user',
        createDate: '2024-01-05T08:45:00Z',
        lastActivity: '2024-12-15T12:00:00Z',
        status: 'inactive',
        groups: [],
        policies: [],
        accessKeys: 0,
        mfaEnabled: false,
        accountId: '123456789012',
        accountName: 'Production Account'
      }
    ]
  });
});

// AWS IAM groups endpoint
app.get('/api/integrations/aws/iam/groups', (req, res) => {
  console.log('AWS IAM groups endpoint hit');
  res.json({
    success: true,
    data: [
      {
        id: '1',
        groupName: 'Administrators',
        arn: 'arn:aws:iam::123456789012:group/Administrators',
        userCount: 1,
        policies: ['AdministratorAccess']
      },
      {
        id: '2',
        groupName: 'Developers',
        arn: 'arn:aws:iam::123456789012:group/Developers',
        userCount: 1,
        policies: ['PowerUserAccess', 'S3FullAccess']
      },
      {
        id: '3',
        groupName: 'ReadOnly',
        arn: 'arn:aws:iam::123456789012:group/ReadOnly',
        userCount: 1,
        policies: ['ReadOnlyAccess']
      }
    ]
  });
});

// AWS accounts endpoint
app.get('/api/integrations/aws/accounts', (req, res) => {
  console.log('AWS accounts endpoint hit');
  res.json({
    success: true,
    data: [
      {
        accountId: '123456789012',
        accountName: 'Production Account',
        status: 'connected'
      },
      {
        accountId: '987654321098',
        accountName: 'Development Account',
        status: 'connected'
      }
    ]
  });
});

// AWS IAM users sync endpoint
app.post('/api/integrations/aws/iam/users/sync', (req, res) => {
  console.log('AWS IAM users sync endpoint hit');
  res.json({
    success: true,
    message: 'Sync completed successfully',
    data: {
      syncedUsers: 4,
      syncedGroups: 3,
      timestamp: new Date().toISOString()
    }
  });
});

// Apps overview endpoint
app.get('/api/apps', (req, res) => {
  console.log('Apps endpoint hit');
  res.json({
    success: true,
    data: [
      {
        id: 'github',
        name: 'GitHub',
        description: 'Code repository platform',
        icon: '🐙',
        isConnected: true,
        connectionCount: 1,
        userCount: 26,
        lastSync: new Date().toISOString()
      },
      {
        id: 'aws',
        name: 'Amazon Web Services',
        description: 'Cloud computing platform',
        icon: '☁️',
        isConnected: true,
        connectionCount: 1,
        userCount: 2,
        lastSync: new Date().toISOString()
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Team communication platform',
        icon: '💬',
        isConnected: false,
        connectionCount: 0,
        userCount: 0,
        lastSync: null
      }
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('404 for:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Quick server running on port ${PORT}`);
  console.log(`📊 Environment: development`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard/overview`);
  console.log(`🔧 Credentials: http://localhost:${PORT}/api/credentials`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
