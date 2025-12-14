"use strict";

const BotData = require("../models/BotData");

async function createRecord({ botType, userEmail, data }) {
  if (!botType) throw new Error("botType missing");
  if (!userEmail) throw new Error("userEmail missing");

  const rec = new BotData({
    botType,
    email: userEmail.toLowerCase(),
    data: data || {},
  });

  await rec.save();
  return rec;
}


async function create(botType, data = {}, userEmail) {
  if (typeof botType === 'object' && botType !== null) {
    return createRecord(botType);
  }
  if (!userEmail) {
    throw new Error("userEmail missing for create()");
  }
  return createRecord({ botType, userEmail, data });
}

async function list({ botType = null, userEmail = null, limit = 200, lean = true } = {}) {
  const q = { status: { $ne: "deleted" } };

  if (botType) q.botType = botType;
  if (userEmail) q.email = userEmail.toLowerCase();

  const cursor = BotData.find(q)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 1000));

  return lean ? cursor.lean() : cursor;
}

async function readRecords({ botName = null, userEmail = null, limit = 200 } = {}) {
  const q = { status: { $ne: "deleted" } };
  if (botName) q.botType = botName;
  if (userEmail) q.email = userEmail.toLowerCase();

  return BotData.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function getByType(userEmail, botType) {
  if (!userEmail) return [];
  const q = {
    email: userEmail.toLowerCase(),
    botType,
    status: { $ne: "deleted" }
  };
  return BotData.find(q).sort({ createdAt: -1 }).lean();
}

async function getAllByEmail(userEmail) {
  if (!userEmail) return [];
  const q = {
    email: userEmail.toLowerCase(),
    status: { $ne: "deleted" },
  };
  return BotData.find(q).sort({ createdAt: -1 }).lean();
}

async function softDeleteById(id, userEmail) {
  if (!id) return null;

  const rec = await BotData.findById(id);
  if (!rec) return null;
  if (userEmail && rec.email !== userEmail.toLowerCase()) return null;

  rec.status = "deleted";
  await rec.save();
  return true;
}

async function deleteById(id, userEmail) {
  if (!id) return null;

  const rec = await BotData.findById(id);
  if (!rec) return null;

  if (userEmail && rec.email !== userEmail.toLowerCase()) return null;

  await BotData.deleteOne({ _id: id });
  return true;
}


async function deleteMany(filter = {}) {
  const q = {};

  if (filter.email) q.email = filter.email.toLowerCase();
  if (filter.botType) q.botType = filter.botType;
  q.status = { $ne: "deleted" };

  const res = await BotData.updateMany(q, { status: "deleted" });
  return (res.modifiedCount || res.nModified || 0);
}


async function updateById(id, userEmail, updates = {}) {
  const rec = await BotData.findById(id);
  if (!rec) return null;

  if (userEmail && rec.email !== userEmail.toLowerCase()) return null;
  rec.data = {
    ...(rec.data || {}),
    ...(updates.data || updates),
  };

  await rec.save();
  return rec;
}

module.exports = {
  createRecord,
  create,
  list,
  readRecords,
  getByType,
  getAllByEmail,
  softDeleteById,
  deleteById,
  deleteMany,
  updateById
};
