const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
};

module.exports = verifyGoogleToken;

// keytool -list -v -keystore "C:\Users\regun\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
