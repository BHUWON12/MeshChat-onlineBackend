const fs = require('fs');
const path = require('path');

const logStream = fs.createWriteStream(
  path.join(__dirname, '../logs/requests.log'),
  { flags: 'a' }
);

exports.logRequest = (req, res, next) => {
  const logData = {
    time: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: req.ip
  };
  
  logStream.write(JSON.stringify(logData) + '\n');
  next();
};

exports.errorLogger = (err, req, res, next) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack
  };
  
  logStream.write(JSON.stringify(errorLog) + '\n');
  next(err);
};
