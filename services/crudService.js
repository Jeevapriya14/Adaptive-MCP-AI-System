// services/crudService.js
"use strict";

const BotData = require("../models/BotData");

/* ============================================================
   createRecord (current signature) accepts:
   { botType, userEmail, data }
   ============================================================ */
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

/* ============================================================
   create (convenience wrapper) used by callers that call:
     crudService.create(botType, data, userEmail)
   ============================================================ */
async function create(botType, data = {}, userEmail) {
  // accept either (botType, data, userEmail) or (object)
  if (typeof botType === 'object' && botType !== null) {
    // call createRecord({botType, userEmail, data})
    return createRecord(botType);
  }
  if (!userEmail) {
    throw new Error("userEmail missing for create()");
  }
  return createRecord({ botType, userEmail, data });
}

/* ============================================================
   READ RECORDS (Generic List)
   filter: { botType?, userEmail?, limit?, lean? }
   ============================================================ */
async function list({ botType = null, userEmail = null, limit = 200, lean = true } = {}) {
  const q = { status: { $ne: "deleted" } };

  if (botType) q.botType = botType;
  if (userEmail) q.email = userEmail.toLowerCase();

  const cursor = BotData.find(q)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 1000));

  return lean ? cursor.lean() : cursor;
}

/* ============================================================
   readRecords – older alias (used by fuzzyFind)
   ============================================================ */
async function readRecords({ botName = null, userEmail = null, limit = 200 } = {}) {
  const q = { status: { $ne: "deleted" } };
  if (botName) q.botType = botName;
  if (userEmail) q.email = userEmail.toLowerCase();

  return BotData.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/* ============================================================
   getByType – for "show all meetings" etc
   ============================================================ */
async function getByType(userEmail, botType) {
  if (!userEmail) return [];
  const q = {
    email: userEmail.toLowerCase(),
    botType,
    status: { $ne: "deleted" }
  };
  return BotData.find(q).sort({ createdAt: -1 }).lean();
}

/* ============================================================
   getAllByEmail – for "show all"
   ============================================================ */
async function getAllByEmail(userEmail) {
  if (!userEmail) return [];
  const q = {
    email: userEmail.toLowerCase(),
    status: { $ne: "deleted" },
  };
  return BotData.find(q).sort({ createdAt: -1 }).lean();
}

/* ============================================================
   softDeleteById — safer than direct delete
   ============================================================ */
async function softDeleteById(id, userEmail) {
  if (!id) return null;

  const rec = await BotData.findById(id);
  if (!rec) return null;

  // Security: ensure only owner can delete
  if (userEmail && rec.email !== userEmail.toLowerCase()) return null;

  rec.status = "deleted";
  await rec.save();
  return true;
}

/* ============================================================
   deleteById — HARD DELETE (rare use)
   ============================================================ */
async function deleteById(id, userEmail) {
  if (!id) return null;

  const rec = await BotData.findById(id);
  if (!rec) return null;

  if (userEmail && rec.email !== userEmail.toLowerCase()) return null;

  await BotData.deleteOne({ _id: id });
  return true;
}

/* ============================================================
   deleteMany – supports:
      deleteMany({ email })
      deleteMany({ email, botType })
   ============================================================ */
async function deleteMany(filter = {}) {
  const q = {};

  if (filter.email) q.email = filter.email.toLowerCase();
  if (filter.botType) q.botType = filter.botType;
  q.status = { $ne: "deleted" };

  const res = await BotData.updateMany(q, { status: "deleted" });
  // Mongo may return modifiedCount or nModified depending on driver
  return (res.modifiedCount || res.nModified || 0);
}

/* ============================================================
   updateById — patch update on "data" object
   ============================================================ */
async function updateById(id, userEmail, updates = {}) {
  const rec = await BotData.findById(id);
  if (!rec) return null;

  if (userEmail && rec.email !== userEmail.toLowerCase()) return null;

  // Merge-level update into "data" field
  rec.data = {
    ...(rec.data || {}),
    ...(updates.data || updates),
  };

  await rec.save();
  return rec;
}

module.exports = {
  // keep old names
  createRecord,
  // new convenience alias used elsewhere
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
