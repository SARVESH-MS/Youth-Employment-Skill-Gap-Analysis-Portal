'use strict';

const { Notification, User } = require('../models');

const notify = (user, type, title, body, { link, meta, actor, priority } = {}) =>
  Notification.create({ user, type, title, body, link, meta, actor, priority });

const notifyAdmins = async (type, title, body, options = {}) => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  if (!admins.length) return [];
  return Notification.insertMany(admins.map(({ _id }) => ({
    user: _id, type, title, body, link: options.link, meta: options.meta, actor: options.actor, priority: options.priority || 'normal',
  })));
};

module.exports = { notify, notifyAdmins };
