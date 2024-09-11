const express = require('express');
const axios = require('axios');

// Firebase SDK
const admin = require('firebase-admin');

// .env variables
require('dotenv').config();

// Store sensitive API keys in environment variables
const recaptchaSite = process.env.RECAPTCHA_SITE_KEY;
const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
const placesApiKey = process.env.PLACES_API_KEY;
const mapsApiKey = process.env.MAPS_API_KEY;

// Verify environment variables loaded (only during development)
console.log('recaptchaSite:', recaptchaSite, '\n');
console.log('recaptchaSecret:', recaptchaSecret, '\n');

const app = express();
app.use(express.json());

// Firebase Admin SDK setup with Application Default Credentials (ADC)
const { GoogleAuth } = require('google-auth-library');
admin.initializeApp({
  // credential: admin.credential.applicationDefault(), // optional: explicit ADC
});

// **IMPORTANT: Remove this alternative initialization block in production**
// // Alternative Firebase Initialization (Not Recommended - use for testing only)
// const serviceAccount = require('./firebase-credentials.json');
// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
// });

// Main API Endpoint 
app.post('/api/data', async (req, res) => {
  const appCheckToken = req.headers['x-firebase-appcheck'];

  console.log("\n", "Token", "\n", "\n", appCheckToken, "\n")

  try {
    // Verify Firebase App Check token for security
    const appCheckResult = await admin.appCheck().verifyToken(appCheckToken);

    if (appCheckResult.appId) {
      console.log('App Check verification successful!');
      placesQuery(req, res);
    } else {
      console.error('App Check verification failed.');
      res.status(403).json({ error: 'App Check verification failed.' });
    }
  } catch (error) {
    console.error('Error verifying App Check token:', error);
    res.status(500).json({ error: 'Error verifying App Check token.' });
  }
});

// Function to query Google Places API
async function placesQuery(req, res) {
  console.log('#################################');
  console.log('\n', 'placesApiKey:', placesApiKey, '\n');

  const queryObject = req.body.request;
  console.log('\n','Request','\n','\n', queryObject, '\n')

  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-FieldMask': '*',
    'X-Goog-Api-Key': placesApiKey,
    'Referer': 'http://localhost:3000',  // Update for production (ie.: req.hostname)
  };

  const myUrl = 'https://places.googleapis.com/v1/places:searchNearby';

  try {
    // Authenticate with ADC
    const auth = new GoogleAuth();
    const { credential } = await auth.getApplicationDefault();

    const response = await axios.post(myUrl, queryObject, { headers, auth: credential });
    
    console.log('############### SUCCESS','\n','\n','Response','\n','\n', );
    const myBody = response.data;
    myBody.places.forEach(place => {
      console.log(place.displayName); 
    });
    res.json(myBody); // Use res.json for JSON data
  } catch (error) {
    console.log('############### ERROR');
    // console.error(error); // Log the detailed error for debugging
    res.status(error.response.status).json(error.response.data); // Use res.json for errors too
  }
}

// Configuration endpoint (send safe config data to the client)
app.get('/api/config', (req, res) => {
  res.json({
    mapsApiKey: process.env.MAPS_API_KEY, 
    recaptchaKey: process.env.RECAPTCHA_SITE_KEY, 
  });
});

// Serve static files
app.use(express.static('static'));

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`, '\n');
});
