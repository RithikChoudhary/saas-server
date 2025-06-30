import mongoose, { Schema, Document } from 'mongoose';

export interface IAWSOrganization extends Document {
  organizationId: string;
  masterAccountId: string;
  masterAccountEmail: string;
  featureSet: 'ALL' | 'CONSOLIDATED_BILLING';
  companyId: mongoose.Types.ObjectId;
  lastSync: Date;
  isActive: boolean;
}

const AWSOrganizationSchema = new Schema<IAWSOrganization>({
  organizationId: { type: String, required: true },
  masterAccountId: { type: String, required: true },
  masterAccountEmail: { type: String, required: true },
  featureSet: { 
    type: String, 
    enum: ['ALL', 'CONSOLIDATED_BILLING'],
    default: 'ALL'
  },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  lastSync: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
AWSOrganizationSchema.index({ organizationId: 1, companyId: 1 }, { unique: true });
AWSOrganizationSchema.index({ companyId: 1 });

export const AWSOrganization = mongoose.model<IAWSOrganization>('AWSOrganization', AWSOrganizationSchema);
