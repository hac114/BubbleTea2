const express = require('express');
const router = express.Router();
const { handleStripeWebhook } = require('../../controllers/api/v1/paymentsController');

// Webhook Stripe
router.post('/payments/webhook', handleStripeWebhook);

// Altre route API v1...
// router.use('/orders', orderRoutes);

module.exports = router;