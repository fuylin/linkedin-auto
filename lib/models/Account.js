import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    ownerId: { type: String, index: true },
    authorUrn: { type: String, required: true, unique: true },
    status: { type: String, enum: ['ACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED'], default: 'ACTIVE', index: true },
    accessToken: { type: String, required: true, select: false },
    tokenExpiresAt: { type: Date, required: true },
    accountType: { type: String, enum: ['person', 'organization'], default: 'person' },
    displayName: { type: String, default: null },
    profilePictureUrl: { type: String, default: null },
    headline: { type: String, default: null },
    email: { type: String, default: null },
    // For organization accounts — links to the person who connected it
    linkedPersonUrn: { type: String, default: null },
    lastScreenSize: { type: String, default: null },
    // AI integration
    aiProvider: { type: String, enum: ['none', 'claude', 'openai', 'gemini'], default: 'none' },
    aiApiKey: { type: String, default: null, select: false }, // encrypted, hidden by default
    aiModel: { type: String, default: '' }, // user's preferred model
  },
  { timestamps: true }
);

export default mongoose.models.Account || mongoose.model('Account', accountSchema);
