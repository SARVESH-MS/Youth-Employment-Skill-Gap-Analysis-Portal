'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const messageSchema = new Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  text: { type: String, required: true, maxlength: 10000 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const assistantConversationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, maxlength: 80, default: 'New chat' },
  messageCount: { type: Number, min: 0, default: 0 },
  messages: { type: [messageSchema], default: [] },
}, { timestamps: true });

assistantConversationSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('AssistantConversation', assistantConversationSchema);
