// controllers/api/v1/paymentsController.js
const mongoose = require('mongoose');
const Ordine = require('../../../models/Ordine');

exports.handleStripeWebhook = async (req, res) => {
  const event = req.body;
  
  try {
    if (!event || !event.type) {
      return res.status(400).json({ error: 'Evento Stripe non valido' });
    }

    if (event.type === 'payment_intent.succeeded') {
      const orderId = event.data?.object?.metadata?.ordineId;
      
      if (!orderId) {
        return res.status(400).json({ error: 'ID ordine mancante nei metadata' });
      }
      
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ error: 'ID ordine non valido' });
      }

      const updatedOrder = await Ordine.findByIdAndUpdate(
        orderId,
        { stato: 'PAGATO', dataPagamento: new Date() },
        { new: true }
      );

      if (!updatedOrder) {
        return res.status(404).json({ error: 'Ordine non trovato' });
      }

      return res.status(200).json(updatedOrder);
    }

    res.status(200).json({ 
      received: true,
      eventType: event.type
    });
    
  } catch (error) {
    // Mock per evitare console.error nei test
    if (process.env.NODE_ENV !== 'test') {
      console.error(`Errore webhook Stripe [${event?.type || 'sconosciuto'}]:`, error);
    }
    
    res.status(500).json({ 
      error: 'Errore interno del server',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};