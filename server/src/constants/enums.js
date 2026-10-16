// Account status
const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
};

// Helper to get enum values as array
const getValues = (enumObj) => Object.values(enumObj);

module.exports = {
  ACCOUNT_STATUS,
  getValues,
};
