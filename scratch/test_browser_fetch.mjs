import { JWT_SECRET } from '../server/config.js';
import jwt from 'jsonwebtoken';

async function testChatEndpoint() {
  const token = jwt.sign(
    { id: 'user_1791541299976_7ebbe5', role: 'pet_owner', email: 'manhdinh2907@gmail.com' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  console.log('Sending request to http://127.0.0.1:5000/api/data/chat...');
  try {
    const res = await fetch('http://127.0.0.1:5000/api/data/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: 'Cho mèo ăn thưởng bao nhiêu là vừa?',
        petId: null
      })
    });

    console.log('HTTP Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response Body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testChatEndpoint();
