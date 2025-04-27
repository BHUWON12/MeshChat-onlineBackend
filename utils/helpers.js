const crypto = require('crypto');

exports.generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

exports.filterObject = (obj, ...allowedFields) => {
  const filteredObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) filteredObj[el] = obj[el];
  });
  return filteredObj;
};
