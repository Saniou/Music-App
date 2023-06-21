const jwt = require('crypto');

const generateJwtSecret = () => {
    const token = jwt
        .randomBytes(64)
        .toString('hex');
    console.log(`Generated JWT_SECRET: ${token}`);
};

generateJwtSecret();