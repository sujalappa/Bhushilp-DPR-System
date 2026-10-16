const mongoose = require('mongoose');
const { ROLES } = require('../../utils/roles');

const assignmentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    forms: [
      {
        type: String,
        enum: [
          'shift-card',
          'fuel',
          'breakdown',
          'trip-management',
          'production',
          'utilization',
          'site-monitoring',
          'ug-production',
          'ug-development',
        ],
        required: true,
      },
    ],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    // See utils/roles.js. `isSuperAdmin` is kept in step with it for older
    // code and for accounts saved before roles existed.
    role: { type: String, enum: ROLES },
    isSuperAdmin: { type: Boolean, default: false },
    // An admin's projects: everything in them is theirs to run.
    adminProjects: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }], default: [] },
    // Who created this account — lets an admin manage a supervisor they've
    // added before giving them any project.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tokenVersion: { type: Number, default: 0 },
    assignments: { type: [assignmentSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('validate', function syncRole() {
  if (!this.role) this.role = this.isSuperAdmin ? 'superadmin' : 'supervisor';
  this.isSuperAdmin = this.role === 'superadmin';
  if (this.role !== 'admin') this.adminProjects = [];
});

// passwordHash must never leave the server — strip it (and __v) from every
// JSON response by default so a controller can't accidentally leak it.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    if (!ret.role) ret.role = ret.isSuperAdmin ? 'superadmin' : 'supervisor';
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
