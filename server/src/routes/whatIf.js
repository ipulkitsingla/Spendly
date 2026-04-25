import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { runWhatIfSimulation } from '../services/whatIfSimulator.js';

const router = Router();
router.use(authRequired);

router.post('/', async (req, res) => {
  try {
    const prompt = req.body?.prompt;
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ message: 'prompt is required' });
    }
    const result = await runWhatIfSimulation(req.userId, prompt);
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    res.status(500).json({ message: 'Failed to run what-if simulation' });
  }
});

export default router;
