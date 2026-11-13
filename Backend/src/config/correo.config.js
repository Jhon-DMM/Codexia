const EMAIL_VERIFICATION_REQUIRED =
  process.env.EMAIL_VERIFICATION_REQUIRED?.trim().toLowerCase() !== 'false';

module.exports = { EMAIL_VERIFICATION_REQUIRED };
