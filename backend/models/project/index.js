// Registry of per-project schemas. Each project has its own MongoDB database
// and therefore its own Mongoose connection, so these schemas are compiled
// into models lazily per-connection (see config/projectDb.js) rather than
// being registered on the default global connection.

module.exports = {
  Vehicle: require('./Vehicle'),
  Driver: require('./Driver'),
  LoadingPoint: require('./LoadingPoint'),
  ShiftLog: require('./ShiftLog'),
  Trip: require('./Trip'),
  ShiftStatus: require('./ShiftStatus'),
  DailyProduction: require('./DailyProduction'),
  FuelLog: require('./FuelLog'),
  EquipmentUtilization: require('./EquipmentUtilization'),
  // Underground projects
  WorkOrder: require('./WorkOrder'),
  Level: require('./Level'),
  Supervisor: require('./Supervisor'),
  Worker: require('./Worker'),
  Heading: require('./Heading'),
  UgProduction: require('./UgProduction'),
  UgDevelopment: require('./UgDevelopment'),
};
