import mongoose, { Schema, Document } from 'mongoose';

export interface IZoomAccount extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  zoomAccountId: string;
  accountName: string;
  accountType: string;
  planType: string;
  licenseCount: number;
  usedLicenses: number;
  maxUsers: number;
  timezone: string;
  language: string;
  country: string;
  phoneCountry: string;
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ZoomAccountSchema: Schema = new Schema({
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
  zoomAccountId: {
    type: String,
    required: true,
    unique: true
  },
  accountName: {
    type: String,
    required: true
  },
  accountType: {
    type: String,
    required: true
  },
  planType: {
    type: String,
    required: true
  },
  licenseCount: {
    type: Number,
    default: 0
  },
  usedLicenses: {
    type: Number,
    default: 0
  },
  maxUsers: {
    type: Number,
    default: 0
  },
  timezone: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  phoneCountry: {
    type: String,
    required: true
  },
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
  collection: 'zoom_accounts'
});

// Indexes
ZoomAccountSchema.index({ companyId: 1, zoomAccountId: 1 }, { unique: true });
ZoomAccountSchema.index({ companyId: 1, connectionId: 1 });
ZoomAccountSchema.index({ companyId: 1, isActive: 1 });

export const ZoomAccount = mongoose.model<IZoomAccount>('ZoomAccount', ZoomAccountSchema);
