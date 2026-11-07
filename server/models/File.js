import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true, trim: true },
  objectKey: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
  isStarred: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'active', 'failed'], default: 'pending', index: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

fileSchema.index({ ownerId: 1, isDeleted: 1, status: 1 });
fileSchema.index({ ownerId: 1, isStarred: 1 });
fileSchema.index({ ownerId: 1, originalName: 'text' });

export default mongoose.model('File', fileSchema);
