import mongoose, { Schema } from 'mongoose';
import { IApp, AppCategory } from '../../shared/types';

const AppSchema = new Schema<IApp>({
  name: {
    type: String,
    required: [true, 'App name is required'],
    trim: true,
    maxlength: [100, 'App name cannot exceed 100 characters']
  },
  category: {
    type: String,
    enum: Object.values(AppCategory),
    required: [true, 'App category is required']
  },
  description: {
    type: String,
    required: [true, 'App description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  logo: {
    type: String,
    required: [true, 'App logo is required']
  },
  website: {
    type: String,
    required: [true, 'App website is required'],
    match: [/^https?:\/\/.+/, 'Please provide a valid website URL']
  },
  features: [{
    type: String,
    trim: true
  }],
  integrations: [{
    type: String,
    enum: ['SSO', 'SCIM', 'API', 'Webhook', 'SAML', 'OAuth', 'LDAP', 'IAM', 'OIDC', 'Azure AD'],
    trim: true
  }],
  pricing: {
    model: {
      type: String,
      required: [true, 'Pricing model is required'],
      enum: ['per_user_monthly', 'per_user_yearly', 'flat_monthly', 'flat_yearly', 'usage_based', 'freemium', 'free', 'pay_as_you_go']
    },
    tiers: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      features: [{
        type: String,
        trim: true
      }]
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
AppSchema.index({ name: 1 });
AppSchema.index({ category: 1 });
AppSchema.index({ isActive: 1 });
AppSchema.index({ createdAt: -1 });

// Virtual for starting price
AppSchema.virtual('startingPrice').get(function() {
  if (!this.pricing.tiers || this.pricing.tiers.length === 0) return 0;
  return Math.min(...this.pricing.tiers.map(tier => tier.price));
});

// Virtual for feature count
AppSchema.virtual('featureCount').get(function() {
  return this.features ? this.features.length : 0;
});

export default mongoose.model<IApp>('App', AppSchema);
