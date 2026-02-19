const express = require('express');
const UserController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/me', authMiddleware, UserController.getProfile);
router.get('/history', authMiddleware, UserController.getHistory);

module.exports = router;