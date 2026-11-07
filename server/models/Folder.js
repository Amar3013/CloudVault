import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 255 },
  parentFolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
}, { timestamps: true });

folderSchema.index({ ownerId: 1, parentFolderId: 1 });

export default mongoose.model('Folder', folderSchema);
