import mongoose, { Schema, Document } from 'mongoose';

export interface IZoomUser extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId;
  zoomUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  userType: number; // 1=Basic, 2=Licensed, 3=On-prem
  status: 'active' | 'inactive' | 'pending';
  department?: string;
  jobTitle?: string;
  location?: string;
  timezone?: string;
  language?: string;
  phoneNumber?: string;
  phoneCountry?: string;
  pmi?: number;
  personalMeetingUrl?: string;
  verified: boolean;
  roleId?: string;
  roleName?: string;
  loginTypes?: string[];
  lastLoginTime?: Date;
  lastClientVersion?: string;
  picUrl?: string;
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ZoomUserSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  connectionId: {
    type: Schema.Types.ObjectId,
    ref: 'ZoomConnection',
    required: true,
    index: true
  },
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'ZoomAccount',
    index: true
  },
  zoomUserId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  userType: {
    type: Number,
    required: true,
    enum: [1, 2, 3] // 1=Basic, 2=Licensed, 3=On-prem
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    required: true
  },
  department: String,
  jobTitle: String,
  location: String,
  timezone: String,
  language: String,
  phoneNumber: String,
  phoneCountry: String,
  pmi: Number,
  personalMeetingUrl: String,
  verified: {
    type: Boolean,
    default: false
  },
  roleId: String,
  roleName: String,
  loginTypes: [String],
  lastLoginTime: Date,
  lastClientVersion: String,
  picUrl: String,
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'zoom_users'
});

// Indexes
ZoomUserSchema.index({ companyId: 1, zoomUserId: 1 }, { unique: true });
ZoomUserSchema.index({ companyId: 1, connectionId: 1 });
ZoomUserSchema.index({ companyId: 1, accountId: 1 });
ZoomUserSchema.index({ companyId: 1, isActive: 1 });
ZoomUserSchema.index({ companyId: 1, userType: 1 });
ZoomUserSchema.index({ companyId: 1, status: 1 });
ZoomUserSchema.index({ email: 1 });

export const ZoomUser = mongoose.model<IZoomUser>('ZoomUser', ZoomUserSchema);
