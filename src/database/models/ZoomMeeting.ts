import mongoose, { Schema, Document } from 'mongoose';

export interface IZoomMeeting extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  hostId: mongoose.Types.ObjectId;
  zoomMeetingId: string;
  uuid: string;
  topic: string;
  type: number; // 1=Instant, 2=Scheduled, 3=Recurring, 8=Recurring with fixed time
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  timezone: string;
  agenda?: string;
  totalSize: number;
  recordingCount: number;
  participantCount: number;
  hasArchive: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  hasScreen: boolean;
  hasRecording: boolean;
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ZoomMeetingSchema: Schema = new Schema({
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
  hostId: {
    type: Schema.Types.ObjectId,
    ref: 'ZoomUser',
    required: true,
    index: true
  },
  zoomMeetingId: {
    type: String,
    required: true
  },
  uuid: {
    type: String,
    required: true,
    unique: true
  },
  topic: {
    type: String,
    required: true
  },
  type: {
    type: Number,
    required: true,
    enum: [1, 2, 3, 8] // 1=Instant, 2=Scheduled, 3=Recurring, 8=Recurring with fixed time
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  duration: {
    type: Number,
    required: true,
    default: 0
  },
  timezone: {
    type: String,
    required: true
  },
  agenda: String,
  totalSize: {
    type: Number,
    default: 0
  },
  recordingCount: {
    type: Number,
    default: 0
  },
  participantCount: {
    type: Number,
    default: 0
  },
  hasArchive: {
    type: Boolean,
    default: false
  },
  hasVideo: {
    type: Boolean,
    default: false
  },
  hasAudio: {
    type: Boolean,
    default: false
  },
  hasScreen: {
    type: Boolean,
    default: false
  },
  hasRecording: {
    type: Boolean,
    default: false
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
  collection: 'zoom_meetings'
});

// Indexes
ZoomMeetingSchema.index({ companyId: 1, uuid: 1 }, { unique: true });
ZoomMeetingSchema.index({ companyId: 1, connectionId: 1 });
ZoomMeetingSchema.index({ companyId: 1, accountId: 1 });
ZoomMeetingSchema.index({ companyId: 1, hostId: 1 });
ZoomMeetingSchema.index({ companyId: 1, startTime: 1 });
ZoomMeetingSchema.index({ companyId: 1, type: 1 });
ZoomMeetingSchema.index({ companyId: 1, isActive: 1 });

export const ZoomMeeting = mongoose.model<IZoomMeeting>('ZoomMeeting', ZoomMeetingSchema);
