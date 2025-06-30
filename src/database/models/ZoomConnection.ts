import mongoose, { Schema, Document } from 'mongoose';

export interface IZoomConnection extends Document {
  companyId: mongoose.Types.ObjectId;
  accountId: string;
  accountName: string;
  accountType: 'basic' | 'pro' | 'business' | 'enterprise' | 'developer';
  accessToken: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  refreshToken: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  scope: string[];
  connectionType: 'oauth';
  isActive: boolean;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ZoomConnectionSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  accountId: {
    type: String,
    required: true
  },
  accountName: {
    type: String,
    required: true
  },
  accountType: {
    type: String,
    enum: ['basic', 'pro', 'business', 'enterprise', 'developer'],
    required: true
  },
  accessToken: {
    encrypted: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true }
  },
  refreshToken: {
    encrypted: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true }
  },
  scope: [{
    type: String
  }],
  connectionType: {
    type: String,
    enum: ['oauth'],
    default: 'oauth'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: Date
}, {
  timestamps: true,
  collection: 'zoom_connections'
});

// Indexes
ZoomConnectionSchema.index({ companyId: 1, accountId: 1 }, { unique: true });
ZoomConnectionSchema.index({ companyId: 1, isActive: 1 });

export const ZoomConnection = mongoose.model<IZoomConnection>('ZoomConnection', ZoomConnectionSchema);
