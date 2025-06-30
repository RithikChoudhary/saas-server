import mongoose, { Schema, Document } from 'mongoose';

export interface IGitHubTeamMember extends Document {
  companyId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: 'member' | 'maintainer';
  addedAt: Date;
  isActive: boolean;
}

const GitHubTeamMemberSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  teamId: {
    type: Schema.Types.ObjectId,
    ref: 'GitHubTeam',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'GitHubUser',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['member', 'maintainer'],
    default: 'member'
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'github_team_members'
});

// Compound indexes
GitHubTeamMemberSchema.index({ companyId: 1, teamId: 1, userId: 1 }, { unique: true });
GitHubTeamMemberSchema.index({ companyId: 1, userId: 1 });
GitHubTeamMemberSchema.index({ companyId: 1, isActive: 1 });

export const GitHubTeamMember = mongoose.model<IGitHubTeamMember>('GitHubTeamMember', GitHubTeamMemberSchema);
