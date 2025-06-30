import mongoose, { Schema } from 'mongoose';

export interface IWebhookLog {
  appId: mongoose.Types.ObjectId;
  action: 'user_provisioned' | 'user_deprovisioned' | 'user_updated' | 'manual_sync';
  externalUserId: string | null;
  email: string | null;
  status: 'success' | 'failed' | 'error';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

const WebhookLogSchema = new Schema<IWebhookLog>({
  appId: {
    type: Schema.Types.ObjectId,
    ref: 'App',
    required: [true, 'App ID is required']
  },
  action: {
    type: String,
    enum: ['user_provisioned', 'user_deprovisioned', 'user_updated', 'manual_sync'],
    required: [true, 'Action is required']
  },
  externalUserId: {
    type: String,
    default: null
  },
  email: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'error'],
    required: [true, 'Status is required']
  },
  message: {
    type: String,
    required: [true, 'Message is required']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
WebhookLogSchema.index({ appId: 1, timestamp: -1 });
WebhookLogSchema.index({ action: 1 });
WebhookLogSchema.index({ status: 1 });
WebhookLogSchema.index({ email: 1 });
WebhookLogSchema.index({ externalUserId: 1 });

export const WebhookLog = mongoose.model<IWebhookLog>('WebhookLog', WebhookLogSchema);
