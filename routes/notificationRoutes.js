import { Router } from 'express';
import { sendToToken, sendToTopic } from '../utils/Notification.js';

const router = Router();

router.post('/send-notification', async (req, res) => {
  const { token, title, body, data, imageUrl } = req.body;
  try {
    const resp = await sendToToken(token, title, body, data, imageUrl);
    res.status(200).json({ message: 'Notification sent successfully', response: resp });
  } catch (err) {
    res.status(500).json({ error: err.message, response: null });
  }
});

router.post('/send-to-topic', async (req, res) => {
    console.log("req.body", req.body);
  const { topic, title, body, data, imageUrl } = req.body;
  try {
    const resp = await sendToTopic(topic, title, body, data, imageUrl);
    res.status(200).json({ message: 'Notification sent successfully', response: resp });
  } catch (err) {
    res.status(500).json({ error: err.message, response: null });
  }
});
export default router;