const express = require('express');
const { createUser } = require('./users/create-user');

const app = express();
app.get('/health', (req, res) => res.json({ ok: true }));
app.post('/users', (req, res) => res.json(createUser(req.body)));

module.exports = app;
