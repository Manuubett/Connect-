// api/notify.js
import admin from 'firebase-admin';

// Initialize Firebase Admin only once
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { oppId } = req.body;
  if (!oppId) return res.status(400).json({ error: 'Missing oppId' });

  try {
    // Get the new opportunity
    const oppDoc = await db.collection('opportunities').doc(oppId).get();
    if (!oppDoc.exists) return res.status(404).json({ error: 'Not found' });

    const opp = oppDoc.data();
    const title = 'New Opportunity!';
    const body = opp.title;

    // Get all FCM tokens
    const usersSnap = await db.collection('users')
      .where('fcmTokens', '!=', null)
      .get();

    const tokens = [];
    usersSnap.forEach(doc => {
      const data = doc.data();
      if (data.fcmTokens) tokens.push(...data.fcmTokens);
    });

    if (tokens.length === 0) {
      return res.json({ success: true, message: 'No tokens' });
    }

    // Send via FCM
    const payload = {
      notification: {
        title,
        body,
        icon: 'https://compus.bettke.space/logo192.png',
      },
      data: {
        url: `https://compus.bettke.space/opportunity.html?id=${oppId}`,
      },
      tokens,
    };

    const response = await admin.messaging().sendMulticast(payload);
    console.log(`Sent to ${response.successCount} devices`);

    res.json({ success: true, sent: response.successCount });
  } catch (error) {
    console.error('FCM Error:', error);
    res.status(500).json({ error: error.message });
  }
}
