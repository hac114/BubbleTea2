const mongoose = require('mongoose');
const Pagamento = require('../../../models/Pagamento');
const { MetodoPagamento, StatoPagamento } = require('../../../enums');

describe('Modello Pagamento', () => {
  describe('Validazione', () => {
    test('dovrebbe creare un pagamento valido', () => {
      const pagamentoData = {
        metodo: MetodoPagamento.CARTA_CREDITO,
        importo: 5.99,
        stato: StatoPagamento.COMPLETATO,
        stripePaymentId: 'tx_123456789' // è il numero di transazione economica
      };
      
      const pagamento = new Pagamento(pagamentoData);      
      
      expect(pagamento.metodo).toBe(pagamentoData.metodo);
      expect(pagamento.importo).toBe(pagamentoData.importo);
      expect(pagamento.stato).toBe(pagamentoData.stato);
      expect(pagamento.idTransazione).toBe(pagamentoData.idTransazione);
    });

    test('dovrebbe fallire con importo negativo', () => {
      const pagamentoData = {
        metodo: MetodoPagamento.CARTA_CREDITO,
        importo: -5.99,
        stato: StatoPagamento.COMPLETATO
      };
      
      const pagamento = new Pagamento(pagamentoData);
      const error = pagamento.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors['importo']).toBeDefined();
    });

    test('dovrebbe fallire senza stripePaymentId', () => {
      const pagamentoData = {
        ordine: new mongoose.Types.ObjectId(),
        metodo: MetodoPagamento.CARTA_CREDITO,
        importo: 5.99,
        stato: StatoPagamento.COMPLETATO
        // stripePaymentId mancante
      };
      
      const pagamento = new Pagamento(pagamentoData);
      const error = pagamento.validateSync();
      expect(error).toBeDefined();
    });
  });
});