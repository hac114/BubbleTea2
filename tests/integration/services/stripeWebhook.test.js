// tests/integration/services/stripeWebhook.test.js
const { handleStripeWebhook } = require('../../../controllers/api/v1/paymentsController');
const Ordine = require('../../../models/Ordine');
const mongoose = require('mongoose');

jest.mock('../../../models/Ordine');

describe('Payments Controller - Stripe Webhook', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      body: {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            metadata: { ordineId: new mongoose.Types.ObjectId().toString() }
          }
        }
      },
      headers: { 'stripe-signature': 'mock-signature' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };

    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  describe('Flusso principale', () => {
    test('dovrebbe aggiornare lo stato a PAGATO per pagamento riuscito', async () => {
      const mockOrder = {
        _id: mockReq.body.data.object.metadata.ordineId,
        stato: 'PAGATO',
        dataPagamento: expect.any(Date)
      };

      Ordine.findByIdAndUpdate.mockResolvedValue(mockOrder);

      await handleStripeWebhook(mockReq, mockRes);

      expect(Ordine.findByIdAndUpdate).toHaveBeenCalledWith(
        mockReq.body.data.object.metadata.ordineId,
        { stato: 'PAGATO', dataPagamento: expect.any(Date) },
        { new: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockOrder);
    });
  });

  describe('Gestione errori', () => {
    test('dovrebbe gestire evento Stripe non valido', async () => {
      mockReq.body = {};
      
      await handleStripeWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Evento Stripe non valido'
      });
    });

    test('dovrebbe gestire ID ordine mancante', async () => {
      delete mockReq.body.data.object.metadata.ordineId;
      
      await handleStripeWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'ID ordine mancante nei metadata'
      });
    });

    test('dovrebbe gestire ID ordine non valido', async () => {
      mockReq.body.data.object.metadata.ordineId = 'id_non_valido';
      
      await handleStripeWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'ID ordine non valido'
      });
    });

    test('dovrebbe gestire ordine non trovato', async () => {
      Ordine.findByIdAndUpdate.mockResolvedValue(null);
      
      await handleStripeWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Ordine non trovato'
      });
    });

    test('dovrebbe gestire errori interni del server', async () => {
      // Simula ambiente di sviluppo per vedere i dettagli
      process.env.NODE_ENV = 'development';
      
      Ordine.findByIdAndUpdate.mockRejectedValue(new Error('DB Error'));
      
      await handleStripeWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Errore interno del server',
        details: 'DB Error'
      });
    });
  });

  describe('Altri eventi Stripe', () => {
    test('dovrebbe rispondere con successo per eventi non gestiti', async () => {
      mockReq.body.type = 'charge.refunded';
      
      await handleStripeWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        received: true,
        eventType: 'charge.refunded'
      });
    });
  });
});