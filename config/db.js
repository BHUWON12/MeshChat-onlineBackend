const mongoose = require('mongoose');
const { MONGODB_URI } = process.env;

module.exports = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('Database Connection Error:', err);
    process.exit(1);
  }
};
