import mongoose, { Schema, Document } from 'mongoose';

export interface IZoomUsageStats extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  date: Date;
  totalMeetings: number;
  totalParticipants: number;
  totalMinutes: number;
  averageDuration: number;
  peakConcurrentMeetings: number;
  recordedMeetings: number;
  cloudRecordingUsage: number; // in GB
  phoneMinutes: number;
  webinarMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ZoomUsageStatsSchema: Schema = new Schema({
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
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  totalMeetings: {
    type: Number,
    default: 0
  },
  totalParticipants: {
    type: Number,
    default: 0
  },
  totalMinutes: {
    type: Number,
    default: 0
  },
  averageDuration: {
    type: Number,
    default: 0
  },
  peakConcurrentMeetings: {
    type: Number,
    default: 0
  },
  recordedMeetings: {
    type: Number,
    default: 0
  },
  cloudRecordingUsage: {
    type: Number,
    default: 0
  },
  phoneMinutes: {
    type: Number,
    default: 0
  },
  webinarMinutes: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'zoom_usage_stats'
});

// Indexes
ZoomUsageStatsSchema.index({ companyId: 1, accountId: 1, date: 1 }, { unique: true });
ZoomUsageStatsSchema.index({ companyId: 1, connectionId: 1 });
ZoomUsageStatsSchema.index({ companyId: 1, date: 1 });
ZoomUsageStatsSchema.index({ companyId: 1, isActive: 1 });

export const ZoomUsageStats = mongoose.model<IZoomUsageStats>('ZoomUsageStats', ZoomUsageStatsSchema);
