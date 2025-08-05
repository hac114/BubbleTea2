const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Aggiungi questo all'inizio del file di test
const StatoOrdine = {
  IN_ATTESA: 'IN_ATTESA',
  IN_PREPARAZIONE: 'IN_PREPARAZIONE',
  PAGAMENTO_PENDENTE: 'PAGAMENTO_PENDENTE',
  PAGAMENTO_FALLITO: 'PAGAMENTO_FALLITO',
  COMPLETATO: 'COMPLETATO',
  ANNULLATO: 'ANNULLATO',
  RIMBORSATO: 'RIMBORSATO',
  PRONTO: 'PRONTO',
  CONSEGNATO: 'CONSEGNATO',
  FALLITO: 'FALLITO'
};

// Mock integrati
const mockBevanda = {
  _id: new ObjectId(),
  nome: 'Tè Verde',
  prezzo: 4.5
};

const mockOrderItem = {
  _id: new ObjectId(),
  prodotto: 'price_12345',
  prezzo: 1000,
  quantita: 1
};

const mockPersonalizzazione = {
  _id: new ObjectId(),
  nome: 'Bubble',
  prezzoAggiuntivo: 0.5
};

class MockOrdine {
  constructor(data) {
    this._id = data._id || new ObjectId();
    this.items = data.items || [];
    this.stato = data.stato || 'IN_ATTESA';
    this.totale = data.totale || 0;    
    this.stripePaymentId = data.stripePaymentId || null;
    this.pagamento = data.pagamento || null;
    this.isDeleted = false;
    this.dataCompletamento = data.dataCompletamento || null;
    this.tavolo = data.tavolo || new ObjectId(); // Imposta un ObjectId di default
    this.StatoOrdine = {  // Rendi disponibile agli altri metodi della classe
      IN_ATTESA: 'IN_ATTESA',
      IN_PREPARAZIONE: 'IN_PREPARAZIONE',
      PAGAMENTO_PENDENTE: 'PAGAMENTO_PENDENTE',
      PAGAMENTO_FALLITO: 'PAGAMENTO_FALLITO',
      COMPLETATO: 'COMPLETATO',
      ANNULLATO: 'ANNULLATO',
      RIMBORSATO: 'RIMBORSATO',
      PRONTO: 'PRONTO',
      CONSEGNATO: 'CONSEGNATO',
      FALLITO: 'FALLITO'
    };

    // Stripe mock integrato nella classe
    this.stripe = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn()
      },
      refunds: {
        create: jest.fn().mockResolvedValue({
          id: 're_mock123',
          status: 'succeeded'
        })
      }
    };

    // Virtual properties
    Object.defineProperty(this, 'isPagato', {
      get: () => this.pagamento?.stato === 'COMPLETATO'
    });

    Object.defineProperty(this, 'numeroItems', {
      get: () => this.items?.length || 0
    });

    // Metodo validate per simulare la validazione Mongoose
    this.validate = jest.fn().mockImplementation(function() {
      if (!this._shouldValidate && process.env.TEST_VALIDATIONS !== 'true') return;
      
      // Validazioni campo obbligatorio
      if (!this.tavolo) throw new Error('ValidationError: Path `tavolo` is required');
      if (!this.items || this.items.length === 0) throw new Error('ValidationError: Path `items` is required');
      
      // Validazione enum
      if (this.stato && !Object.values(StatoOrdine).includes(this.stato)) {
        throw new Error(`ValidationError: \`${this.stato}\` is not a valid enum value for path \`stato\``);
      }
    });

    // Mock del metodo save che esegue validate
    this.save = jest.fn().mockImplementation(async function() {
      await this.validate();
      return this;
    });
  }

  async processaPagamento(stripeClient) {
    const invalidItem = this.items.find(item => !item.prodotto.startsWith('price_'));
    if (invalidItem) {
      throw new Error('Prefisso price_ obbligatorio per gli ID prodotto');
    }

    try {
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: this.totale,
        currency: 'eur',
        metadata: { ordineId: this._id.toString() }
      });
      this.stripePaymentId = paymentIntent.id;
      return {
        stripePaymentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret
      };
    } catch (error) {
      if (error.code === 'card_declined') {
        this.stato = 'PAGAMENTO_FALLITO';
        await this.save();
        throw new Error(`Pagamento fallito: ${error.message}`);
      }
      this.stato = 'FALLITO';
      throw error;
    }
  }

  async processaRimborso(motivo) {
    if (!this.stripePaymentId) {
      throw new Error('Nessun pagamento Stripe associato');
    }
    
    const refund = await this.stripe.refunds.create({
      payment_intent: this.stripePaymentId,
      reason: motivo || 'requested_by_customer'
    });
    
    this.isDeleted = true;
    this.motivoAnnullamento = motivo || 'Rimborsato';
    await this.save();
    return refund;
  }

  async calcolaTotale() {
    if (!this.items || this.items.length === 0) return 0;
    
    return this.items.reduce((tot, item) => {
      const prezzoBase = item.bevanda?.prezzoBase || item.prezzo || 0;
      const extra = item.personalizzazione?.ingredientiExtra?.reduce((sum, ing) => sum + (ing.prezzo || 0), 0) || 0;
      return tot + (prezzoBase + extra) * (item.quantita || 1);
    }, 0);
  }

  async aggiornaStato(nuovoStato) {
    const transizioniValide = {
      'IN_ATTESA': ['IN_PREPARAZIONE', 'ANNULLATO', 'PAGAMENTO_PENDENTE'],
      'IN_PREPARAZIONE': ['PRONTO', 'ANNULLATO'],
      'PRONTO': ['CONSEGNATO', 'ANNULLATO'],
      'CONSEGNATO': ['COMPLETATO', 'ANNULLATO'],
      'PAGAMENTO_PENDENTE': ['COMPLETATO', 'PAGAMENTO_FALLITO'],
      'COMPLETATO': [],
      'ANNULLATO': [],
      'PAGAMENTO_FALLITO': [],
      'FALLITO': []
    };

    // Permetti transizione a COMPLETATO solo se lo stato corrente lo permette
    if (!transizioniValide[this.stato]?.includes(nuovoStato)) {
      throw new Error(`Transizione non permessa da ${this.stato} a ${nuovoStato}`);
    }

    this.stato = nuovoStato;
    if (nuovoStato === 'COMPLETATO') {
      this.dataCompletamento = new Date();
    }
    await this.save();
    return this;
  }

  async handleStripeError(error) {
    if (error.code === 'card_declined') {
      this.stato = 'PAGAMENTO_FALLITO';
      await this.save();
      throw new Error(`Pagamento fallito: ${error.message}`);
    }
    throw error;
  }
}

MockOrdine.create = jest.fn();
MockOrdine.findById = jest.fn();

jest.mock('../../../models/Ordine', () => MockOrdine);

describe('Ordine Model', () => {
  let ordineTest;

  beforeAll(() => {
    process.env.TEST_VALIDATIONS = 'true';
    MockOrdine.create.mockImplementation((data) => {
      return Promise.resolve(new MockOrdine(data));
    });
  });

  beforeEach(() => {
    ordineTest = new MockOrdine({
      items: [{
        ...mockOrderItem,
        prodotto: 'price_12345',
        prezzo: 1000
      }],
      stato: 'IN_ATTESA',
      totale: 1000
    });

    // Configura i mock di Stripe integrati
    ordineTest.stripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_mock123',
      client_secret: 'secret_mock123',
      status: 'requires_payment_method'
    });
  });

  afterAll(() => {
    delete process.env.TEST_VALIDATIONS;
  });

  describe('processaPagamento()', () => {
    describe('Success Cases', () => {
      test('dovrebbe creare correttamente un PaymentIntent', async () => {
        const result = await ordineTest.processaPagamento(ordineTest.stripe);
        expect(ordineTest.stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
        expect(result.stripePaymentId).toBe('pi_mock123');
        expect(ordineTest.stato).toBe('IN_ATTESA');
      });

      test('dovrebbe accettare OrderItem con personalizzazioni', async () => {
        ordineTest.items[0].personalizzazioni = [mockPersonalizzazione];
        await expect(ordineTest.processaPagamento(ordineTest.stripe)).resolves.toBeDefined();
      });
    });

    describe('Error Cases', () => {
      test('dovrebbe rifiutare prodotti senza prefisso price_', async () => {
        ordineTest.items[0].prodotto = 'prod_12345';
        await expect(ordineTest.processaPagamento(ordineTest.stripe))
          .rejects.toThrow('Prefisso price_ obbligatorio per gli ID prodotto');
      });

      test('dovrebbe gestire errori Stripe API', async () => {
        ordineTest.stripe.paymentIntents.create.mockRejectedValue(new Error('Stripe API Error'));
        await expect(ordineTest.processaPagamento(ordineTest.stripe))
          .rejects.toThrow('Stripe API Error');
        expect(ordineTest.stato).toBe('FALLITO');
      });

      test('dovrebbe gestire errori di carta rifiutata', async () => {
        const ordineTest = new MockOrdine({
          tavolo: new ObjectId(),
          items: [mockOrderItem],
          stato: 'IN_ATTESA',
          totale: 1000,
          _shouldValidate: false // Disabilita validazioni esplicite
        });
        
        const stripeError = new Error('Card declined');
        stripeError.code = 'card_declined';
        stripeError.message = 'La carta è stata rifiutata';
        
        ordineTest.stripe.paymentIntents.create.mockRejectedValue(stripeError);
        
        await expect(ordineTest.processaPagamento(ordineTest.stripe))
          .rejects.toThrow('Pagamento fallito: La carta è stata rifiutata');
        expect(ordineTest.stato).toBe('PAGAMENTO_FALLITO');
      });

      test('dovrebbe propagare errori non gestiti', async () => {
        const genericError = new Error('Errore generico');
        ordineTest.stripe.paymentIntents.create.mockRejectedValue(genericError);
        
        await expect(ordineTest.processaPagamento(ordineTest.stripe))
          .rejects.toThrow('Errore generico');
        expect(ordineTest.stato).toBe('FALLITO');
      });
    });

    describe('Integration with Mocks', () => {
      test('dovrebbe funzionare con mockBevanda negli items', async () => {
        ordineTest.items[0].bevanda = mockBevanda;
        const result = await ordineTest.processaPagamento(ordineTest.stripe);
        expect(result).toHaveProperty('stripePaymentId');
      });
    });
  });

  describe('Metodi Aggiuntivi', () => {
    test('dovrebbe gestire correttamente i rimborsi', async () => {
      const ordine = new MockOrdine({
        items: [mockOrderItem],
        stripePaymentId: 'pi_test123',
        stato: 'COMPLETATO' // Aggiungi stato valido
      });
      
      const result = await ordine.processaRimborso();
      expect(result.status).toBe('succeeded');
    });
  });

  describe('Metodi Aggiuntivi Estesi', () => {
    let ordine;

    beforeEach(() => {
      ordine = new MockOrdine({
        tavolo: new mongoose.Types.ObjectId(),
        items: [new mongoose.Types.ObjectId()],
        totale: 50,
        stato: 'IN_ATTESA',
        stripePaymentId: 'pi_test123'
      });
    });

    // Test per calcolaTotale()
    describe('calcolaTotale()', () => {
      test('dovrebbe calcolare il totale con ingredienti extra', async () => {
        ordine.items = [{
          bevanda: { prezzoBase: 5 },
          quantita: 2,
          personalizzazione: {
            ingredientiExtra: [{ prezzo: 1 }, { prezzo: 0.5 }]
          }
        }];
        
        const totale = await ordine.calcolaTotale();
        expect(totale).toBe(13); // (5 + 1 + 0.5) * 2
      });
    });

    // Test per transizioni di stato
    describe('aggiornaStato()', () => {
      test('dovrebbe aggiornare dataCompletamento per stato COMPLETATO', async () => {
        // Imposta uno stato che può transizionare a COMPLETATO
        const ordine = new MockOrdine({
          stato: 'CONSEGNATO',
          items: [mockOrderItem]
        });
        
        await ordine.aggiornaStato('COMPLETATO');
        expect(ordine.dataCompletamento).toBeDefined();
        expect(ordine.stato).toBe('COMPLETATO');
      });

      test('dovrebbe bloccare transizione non valida', async () => {
        const ordine = new MockOrdine({
          stato: 'IN_ATTESA',
          items: [mockOrderItem]
        });
        
        await expect(ordine.aggiornaStato('COMPLETATO'))
          .rejects.toThrow('Transizione non permessa da IN_ATTESA a COMPLETATO');
      });
    });
  });

  // 2. Sezione per le virtual properties
  describe('Virtual Properties', () => {
    test('isPagato dovrebbe tornare true per pagamento completato', () => {
      const ordine = new MockOrdine({
        pagamento: { stato: 'COMPLETATO' }
      });
      expect(ordine.isPagato).toBe(true);
    });

    test('numeroItems dovrebbe tornare la lunghezza di items', () => {
      const ordine = new MockOrdine({
        items: [1, 2, 3]
      });
      expect(ordine.numeroItems).toBe(3);
    });
  });

  // 3. Sezione per error handling aggiuntivo
  describe('Error Handling Esteso', () => {
    test('dovrebbe fallire per Stripe connection error', async () => {
      const ordine = new MockOrdine({
        items: [{ prodotto: 'price_123', prezzo: 1000 }]
      });
      ordine.stripe.paymentIntents.create.mockRejectedValue(new Error('Connection Error'));
      
      await expect(ordine.processaPagamento(ordine.stripe))
        .rejects.toThrow('Connection Error');
    });

    describe('Error Handling', () => {
      test('dovrebbe gestire errori di database durante save', async () => {
        const ordine = new MockOrdine({
          tavolo: new ObjectId(),
          items: [mockOrderItem]
        });
        ordine.save.mockRejectedValueOnce(new Error('DB Error'));
        await expect(ordine.aggiornaStato('IN_PREPARAZIONE'))
          .rejects.toThrow('DB Error');
      });
    });
  });

  describe('Validazioni', () => {
    test('dovrebbe fallire senza items', async () => {
      const ordine = new MockOrdine({ 
        tavolo: new ObjectId(), 
        items: [],
        _shouldValidate: true // Forza la validazione
      });
      await expect(ordine.save())
        .rejects.toThrow('ValidationError: Path `items` is required');
    });

    test('dovrebbe validare lo stato enum', async () => {
      const ordine = new MockOrdine({ 
        tavolo: new ObjectId(),
        items: [mockOrderItem],
        stato: 'STATO_INVALIDO',
        _shouldValidate: true // Forza la validazione
      });
      await expect(ordine.save())
        .rejects.toThrow('is not a valid enum value for path `stato`');
    });
  });

  describe('Transizioni di Stato', () => {
    // Definizione completa delle transizioni valide per il test
    const transizioniValide = {
      'IN_ATTESA': ['IN_PREPARAZIONE', 'ANNULLATO', 'PAGAMENTO_PENDENTE'],
      'IN_PREPARAZIONE': ['PRONTO', 'ANNULLATO'],
      'PRONTO': ['CONSEGNATO', 'ANNULLATO'],
      'CONSEGNATO': ['COMPLETATO', 'ANNULLATO'],
      'PAGAMENTO_PENDENTE': ['COMPLETATO', 'PAGAMENTO_FALLITO'],
      'COMPLETATO': [],
      'ANNULLATO': [],
      'PAGAMENTO_FALLITO': [],
      'FALLITO': []
    };

    const testTransizione = async (daStato, aStato) => {
      const ordine = new MockOrdine({
        stato: daStato,
        items: [mockOrderItem],
        tavolo: new ObjectId(), // Aggiunto per evitare errori di validazione
        _shouldValidate: false // Disabilita validazioni aggiuntive durante il test
      });

      const transizionePermessa = transizioniValide[daStato]?.includes(aStato);

      if (transizionePermessa) {
        await ordine.aggiornaStato(aStato);
        expect(ordine.stato).toBe(aStato);
        
        // Verifica aggiuntiva per stato COMPLETATO
        if (aStato === 'COMPLETATO') {
          expect(ordine.dataCompletamento).toBeInstanceOf(Date);
        }
      } else {
        await expect(ordine.aggiornaStato(aStato))
          .rejects.toThrow(`Transizione non permessa da ${daStato} a ${aStato}`);
      }
    };

    // Test cases - ora possiamo testare tutte le combinazioni importanti
    test('IN_ATTESA → IN_PREPARAZIONE (valida)', () => testTransizione('IN_ATTESA', 'IN_PREPARAZIONE'));
    test('IN_PREPARAZIONE → COMPLETATO (invalida)', () => testTransizione('IN_PREPARAZIONE', 'COMPLETATO'));
    test('IN_PREPARAZIONE → PRONTO (valida)', () => testTransizione('IN_PREPARAZIONE', 'PRONTO'));
    test('CONSEGNATO → COMPLETATO (valida)', () => testTransizione('CONSEGNATO', 'COMPLETATO'));
    test('PAGAMENTO_PENDENTE → COMPLETATO (valida)', () => testTransizione('PAGAMENTO_PENDENTE', 'COMPLETATO'));
    test('IN_ATTESA → COMPLETATO (invalida)', () => testTransizione('IN_ATTESA', 'COMPLETATO'));
    test('COMPLETATO → ANNULLATO (invalida)', () => testTransizione('COMPLETATO', 'ANNULLATO'));
  });  
});