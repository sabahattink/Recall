import express from 'express';
import { formatUser } from '@fixture/shared';

const app = express();
app.get('/users/:id', (req, res) => {
  res.json(formatUser({ id: req.params.id, name: 'Ada' }));
});

export default app;
