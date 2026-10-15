const mongoose = require('mongoose');
const { crewSchemaFields } = require('../../utils/crew');

// Underground development: one shift's work on one heading, under one work
// order. `tons` is ore
// for an ore drive and rock otherwise (the heading's kind says which);
// `progress` is metres advanced that shift.
const ugDevelopmentSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    shift: { type: String, enum: ['I', 'II', 'III', 'General'], required: true },
    workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    headingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Heading', required: true },
    supervisors: { type: Number, min: 0 },
    drillers: { type: Number, min: 0 },
    helpers: { type: Number, min: 0 },
    blasters: { type: Number, min: 0 },
    muckers: { type: Number, min: 0 },
    // Who the drillers, helpers, blasters and muckers were — optional, and
    // never more names than that trade's head count.
    ...crewSchemaFields(),
    // Who supervised: one name per supervisor counted, or the person in
    // charge when the count is 0 — so at most max(1, supervisors) names.
    supervisorIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supervisor' }], default: [] },
    tons: { type: Number, min: 0 },
    filling: { type: Number, min: 0 },
    progress: { type: Number, min: 0 },
    remark: { type: String, trim: true },
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

ugDevelopmentSchema.index({ date: 1, shift: 1, workOrderId: 1, headingId: 1 }, { unique: true });
ugDevelopmentSchema.index({ workOrderId: 1, date: 1 });
ugDevelopmentSchema.index({ headingId: 1, date: 1 });

module.exports = ugDevelopmentSchema;
