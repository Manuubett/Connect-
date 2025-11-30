import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  const { title, body, url, targetUid } = JSON.parse(event.body);

  try {
    let tokens = [];

    if (targetUid) {
      const userDoc = await db.collection('users').doc(targetUid).get();
      if (userDoc.exists) tokens = userDoc.data()?.fcmTokens || [];
    } else {
      const snap = await db.collection('users').where('fcmTokens', '!=', null).get();
      snap.forEach(doc => tokens.push(...(doc.data()?.fcmTokens || [])));
    }

    if (tokens.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ sent: 0 })
      };
    }

    const message = {
      notification: { title, body },
      data: { url: url || 'https://compus.bettke.space/' },
      tokens,
    };

    const response = await admin.messaging().sendMulticast(message);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        sent: response.successCount
      })
    };

  } catch (error) {
    console.error("FCM Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
