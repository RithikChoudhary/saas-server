import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceConnection extends Document {
  companyId: mongoose.Types.ObjectId;
  serviceType: 'aws' | 'azure' | 'office365' | 'github' | 'gitlab' | 'google-workspace';
  serviceName: string;
  status: 'connected' | 'error' | 'syncing' | 'pending' | 'disconnected';
  connectionData: {
    accountId?: string;
    subscriptionId?: string;
    tenantId?: string;
    organizationId?: string;
    [key: string]: any;
  };
  credentials: {
    [key: string]: any;
  };
  lastSync?: Date;
  syncStatus?: string;
  syncError?: string;
  metrics: {
    users: number;
    resources: number;
    monthlyCost: number;
    securityScore: number;
    [key: string]: any;
  };
  settings: {
    autoSync: boolean;
    syncInterval: number; // in minutes
    notifications: boolean;
    [key: string]: any;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceConnectionSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  serviceType: {
    type: String,
    enum: ['aws', 'azure', 'office365', 'github', 'gitlab', 'google-workspace'],
    required: true,
    index: true
  },
  serviceName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['connected', 'error', 'syncing', 'pending', 'disconnected'],
    default: 'pending',
    index: true
  },
  connectionData: {
    type: Schema.Types.Mixed,
    default: {}
  },
  credentials: {
    type: Schema.Types.Mixed,
    default: {}
  },
  lastSync: {
    type: Date,
    default: null
  },
  syncStatus: {
    type: String,
    default: null
  },
  syncError: {
    type: String,
    default: null
  },
  metrics: {
    users: { type: Number, default: 0 },
    resources: { type: Number, default: 0 },
    monthlyCost: { type: Number, default: 0 },
    securityScore: { type: Number, default: 0, min: 0, max: 100 }
  },
  settings: {
    autoSync: { type: Boolean, default: true },
    syncInterval: { type: Number, default: 60 }, // 1 hour default
    notifications: { type: Boolean, default: true }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'service_connections'
});

// Indexes for performance
ServiceConnectionSchema.index({ companyId: 1, serviceType: 1 });
ServiceConnectionSchema.index({ companyId: 1, status: 1 });
ServiceConnectionSchema.index({ companyId: 1, isActive: 1 });
ServiceConnectionSchema.index({ serviceType: 1, status: 1 });

// Virtual for formatted last sync
ServiceConnectionSchema.virtual('lastSyncFormatted').get(function(this: IServiceConnection) {
  if (!this.lastSync) return 'Never';
  
  const now = new Date();
  const diff = now.getTime() - this.lastSync.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
});

// Static methods
ServiceConnectionSchema.statics.findByCompany = function(companyId: string) {
  return this.find({ companyId, isActive: true });
};

ServiceConnectionSchema.statics.findByService = function(companyId: string, serviceType: string) {
  return this.find({ companyId, serviceType, isActive: true });
};

ServiceConnectionSchema.statics.getConnectedServices = function(companyId: string) {
  return this.find({ 
    companyId, 
    status: 'connected', 
    isActive: true 
  }).select('serviceType serviceName status lastSync metrics');
};

ServiceConnectionSchema.statics.getCompanyStats = function(companyId: string) {
  return this.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), isActive: true } },
    {
      $group: {
        _id: null,
        totalConnections: { $sum: 1 },
        connectedServices: {
          $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] }
        },
        totalUsers: { $sum: '$metrics.users' },
        totalCost: { $sum: '$metrics.monthlyCost' },
        totalResources: { $sum: '$metrics.resources' },
        avgSecurityScore: { $avg: '$metrics.securityScore' }
      }
    }
  ]);
};

ServiceConnectionSchema.statics.getServiceTypeStats = function(companyId: string) {
  return this.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), isActive: true } },
    {
      $group: {
        _id: '$serviceType',
        count: { $sum: 1 },
        connected: {
          $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] }
        },
        totalUsers: { $sum: '$metrics.users' },
        totalCost: { $sum: '$metrics.monthlyCost' }
      }
    }
  ]);
};

// Pre-save middleware to encrypt sensitive data
ServiceConnectionSchema.pre('save', function(next) {
  // TODO: Implement encryption for credentials
  // For now, we'll store them as-is but in production should encrypt
  next();
});

export const ServiceConnection = mongoose.model<IServiceConnection>('ServiceConnection', ServiceConnectionSchema);
