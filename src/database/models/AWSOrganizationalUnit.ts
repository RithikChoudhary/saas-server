import mongoose, { Schema, Document } from 'mongoose';

export interface IAWSOrganizationalUnit extends Document {
  ouId: string;
  name: string;
  arn: string;
  parentId?: string;
  organizationId: string;
  accountCount: number;
  companyId: mongoose.Types.ObjectId;
  lastSync: Date;
  isActive: boolean;
}

const AWSOrganizationalUnitSchema = new Schema<IAWSOrganizationalUnit>({
  ouId: { type: String, required: true },
  name: { type: String, required: true },
  arn: { type: String, required: true },
  parentId: { type: String },
  organizationId: { type: String, required: true },
  accountCount: { type: Number, default: 0 },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  lastSync: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
AWSOrganizationalUnitSchema.index({ ouId: 1, companyId: 1 }, { unique: true });
AWSOrganizationalUnitSchema.index({ organizationId: 1, companyId: 1 });
AWSOrganizationalUnitSchema.index({ parentId: 1 });

export const AWSOrganizationalUnit = mongoose.model<IAWSOrganizationalUnit>('AWSOrganizationalUnit', AWSOrganizationalUnitSchema);
