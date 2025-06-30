import mongoose, { Schema } from 'mongoose';
import { IUserAppAccess } from '../../shared/types';

const UserAppAccessSchema = new Schema<IUserAppAccess>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company ID is required']
  },
  appId: {
    type: Schema.Types.ObjectId,
    ref: 'App',
    required: [true, 'App ID is required']
  },
  companyAppId: {
    type: Schema.Types.ObjectId,
    ref: 'CompanyApp',
    required: [true, 'Company App ID is required']
  },
  accessLevel: {
    type: String,
    enum: ['full', 'limited', 'read_only'],
    default: 'full'
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'admin', 'delete', 'share', 'export'],
    trim: true
  }],
  grantedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Granted by user ID is required']
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessed: {
    type: Date,
    default: null
  },
  accessCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  externalUserId: {
    type: String,
    default: null
  },
  lastSyncedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
UserAppAccessSchema.index({ userId: 1, appId: 1 });
UserAppAccessSchema.index({ userId: 1 });
UserAppAccessSchema.index({ companyId: 1 });
UserAppAccessSchema.index({ appId: 1 });
UserAppAccessSchema.index({ isActive: 1 });
UserAppAccessSchema.index({ expiresAt: 1 });
UserAppAccessSchema.index({ lastAccessed: -1 });

// Virtual for access status
UserAppAccessSchema.virtual('accessStatus').get(function(this: IUserAppAccess) {
  if (!this.isActive) return 'inactive';
  if (this.expiresAt && this.expiresAt < new Date()) return 'expired';
  return 'active';
});

// Virtual for days since last access
UserAppAccessSchema.virtual('daysSinceLastAccess').get(function(this: IUserAppAccess) {
  if (!this.lastAccessed) return null;
  const now = new Date();
  const lastAccess = new Date(this.lastAccessed);
  const diffTime = now.getTime() - lastAccess.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for expiry status
UserAppAccessSchema.virtual('isExpired').get(function(this: IUserAppAccess) {
  return this.expiresAt && this.expiresAt < new Date();
});

// Pre-save middleware to set default permissions based on access level
UserAppAccessSchema.pre('save', function(this: IUserAppAccess, next) {
  if (this.isModified('accessLevel') && (!this.permissions || this.permissions.length === 0)) {
    switch (this.accessLevel) {
      case 'full':
        this.permissions = ['read', 'write', 'share', 'export'];
        break;
      case 'limited':
        this.permissions = ['read', 'write'];
        break;
      case 'read_only':
        this.permissions = ['read'];
        break;
      default:
        this.permissions = ['read'];
    }
  }
  next();
});

// Instance method to record access
UserAppAccessSchema.methods.recordAccess = function() {
  this.lastAccessed = new Date();
  this.accessCount += 1;
  return this.save();
};

// Instance method to check if user has specific permission
UserAppAccessSchema.methods.hasPermission = function(permission: string): boolean {
  return this.permissions.includes(permission);
};

export default mongoose.model<IUserAppAccess>('UserAppAccess', UserAppAccessSchema);
