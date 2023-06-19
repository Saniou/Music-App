const crypto = require('crypto');

const generateJwtSecret = () => {
  const token = crypto.randomBytes(64).toString('hex');
  console.log(`Generated JWT_SECRET: ${token}`);
};

generateJwtSecret();