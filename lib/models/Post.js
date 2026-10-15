import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    ownerId: { type: String, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    commentary: { type: String, required: true, trim: true, maxlength: 5000 },
    mediaUrl: { type: String, default: null },
    scheduledAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    linkedinPostUrn: { type: String, default: null },
    publishedAt: { type: Date, default: null },
    errorMessage: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    sheetSource: {
      key: { type: String, default: null },
      spreadsheetId: { type: String, default: null },
      sheetId: { type: Number, default: null },
      imageUrl: { type: String, default: null },
    },
    importSource: {
      key: { type: String, default: null },
    },
    analytics: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      fetchedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

postSchema.index({ status: 1, scheduledAt: 1 });
postSchema.index({ ownerId: 1, status: 1, scheduledAt: 1 });
postSchema.index({ 'sheetSource.key': 1 }, { unique: true, partialFilterExpression: { 'sheetSource.key': { $type: 'string' } } });
postSchema.index({ 'importSource.key': 1 }, { unique: true, partialFilterExpression: { 'importSource.key': { $type: 'string' } } });

export default mongoose.models.Post || mongoose.model('Post', postSchema);
