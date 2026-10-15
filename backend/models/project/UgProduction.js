const mongoose = require('mongoose');
const { crewSchemaFields } = require('../../utils/crew');

// Underground level production: one gang's shift on one level, under one
// work order. The key includes the supervisor because a level can have two
// gangs in the same shift. Only what is counted on site is stored — head
// counts and tubs.
// Tons, m3, total manpower and OMS are computed on read (see
// ugProductionController.withComputed) from the level's conversion
// factors, so they can't drift from the inputs.
const ugProductionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    shift: { type: String, enum: ['I', 'II', 'III', 'General'], required: true },
    workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supervisor', required: true },
    supervisors: { type: Number, min: 0 },
    drillers: { type: Number, min: 0 },
    helpers: { type: Number, min: 0 },
    muckers: { type: Number, min: 0 },
    blasters: { type: Number, min: 0 },
    // Who the drillers, helpers, muckers and blasters were — optional, and
    // never more names than that trade's head count.
    ...crewSchemaFields(),
    tubs: { type: Number, required: true, min: 0 },
    remark: { type: String, trim: true },
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

ugProductionSchema.index({ date: 1, shift: 1, workOrderId: 1, levelId: 1, supervisorId: 1 }, { unique: true });
ugProductionSchema.index({ workOrderId: 1, date: 1 });
ugProductionSchema.index({ levelId: 1, date: 1 });

module.exports = ugProductionSchema;
