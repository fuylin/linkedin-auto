import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },

  // Cashfree payment details
  cashfreeOrderId: { type: String, default: null },
  cashfreePaymentId: { type: String, unique: true, sparse: true },
  cashfreePaymentLink: { type: String, default: null },

  amount: { type: Number, required: true },       // in paise
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
    default: 'created',
  },
  method: { type: String, default: '' },           // upi, card, netbanking, wallet
  description: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ status: 1 });

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
