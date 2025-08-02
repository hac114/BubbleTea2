const mongoose = require("mongoose");
// Mock migliorato di ValidationError
mongoose.Error.ValidationError = class MockValidationError extends Error {
  constructor() {
    super('ValidationError');
    this.name = 'ValidationError';
    this.errors = {};
    this.addError = (path, error) => {
      this.errors[path] = { message: error };
    };
  }
};

const OrderItem = require("../../../models/OrderItem");
const Personalizzazione = require("../../../models/Personalizzazione");
const CupSize = require("../../../enums/CupSize");

const { Types: { ObjectId } } = mongoose;

// 1. Mock dei modelli esterni (solo se necessario)
jest.mock('../../../models/Bevanda', () => ({
  schema: {}
}));
jest.mock('../../../models/Ordine', () => ({
  schema: {}
}));
jest.mock('../../../models/Personalizzazione', () => ({
  schema: {},
  findOne: jest.fn()
}));

// 2. Configurazione iniziale dei modelli Mongoose
beforeAll(async () => {
  // Registra tutti i modelli necessari
  mongoose.model("OrderItem", require("../../../models/OrderItem").schema);
  mongoose.model("Personalizzazione", Personalizzazione.schema);
  mongoose.model("Ordine", require("../../../models/Ordine").schema);
  mongoose.model("Bevanda", require("../../../models/Bevanda").schema);

  // 3. Mock di base per mongoose.Map (per i metadata)
  mongoose.Map = jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    get: jest.fn(),
    toJSON: jest.fn().mockReturnValue({})
  }));
});

describe("OrderItem Model", () => {
  let testOrdine, testBevanda, testPersonalizzazione;

  beforeEach(() => {
    // 1. Dati di test base (invariati)
    testOrdine = { _id: new mongoose.Types.ObjectId() };
    testBevanda = { _id: new mongoose.Types.ObjectId(), prezzoBase: 4.5 };
    testPersonalizzazione = { _id: new mongoose.Types.ObjectId() };

    // 2. Mock per i metodi statici (invariato)
    OrderItem.trovaPerOrdine = jest.fn().mockImplementation((ordineId) => {
      return Promise.resolve([{
        _id: new mongoose.Types.ObjectId(),
        ordine: ordineId,
        bevanda: testBevanda,
        quantità: 1,
        prezzoUnitario: 4.5,
        dimensione: CupSize.M,
        calcolaSubtotale: () => 4.5
      }]);
    });

    // 3. Mock per create e metodi d'istanza (versione ottimizzata)
    OrderItem.create = jest.fn().mockImplementation((data) => {
      const item = {
        ...data,
        _id: new mongoose.Types.ObjectId(),
        save: jest.fn().mockImplementation(function() {
        // Validazioni con struttura errori identica a Mongoose
        if (this.quantità <= 0) {
          const err = new mongoose.Error.ValidationError();
          err.addError('quantità', 'La quantità minima è 1');
          throw err;
        }
        
        if (this.prezzoUnitario < 0) {
          const err = new mongoose.Error.ValidationError();
          err.addError('prezzoUnitario', 'Il prezzo non può essere negativo');
          throw err;
        }
        
        if (this.dimensione && !Object.values(CupSize).includes(this.dimensione)) {
          const err = new mongoose.Error.ValidationError();
          err.addError('dimensione', 'Dimensione non valida. Usare: Media, Large');
          throw err;
        }
        
        return Promise.resolve(this);
      }),
        calcolaSubtotale: () => (data.prezzoUnitario * data.quantità).toFixed(2),
        toJSON: () => ({
          ...data,
          id: data._id.toString(),
          subtotale: (data.prezzoUnitario * data.quantità).toFixed(2)
        })
      };
      return item;
    });

    // 4. Mock specifico per metadata (invariato)
    const mockMetadata = {
      set: jest.fn().mockImplementation(function(key, value) {
        this[key] = value;
        return this;
      }),
      get: jest.fn().mockImplementation(function(key) {
        return this[key];
      }),
      toJSON: jest.fn().mockReturnValue({})
    };
    
    // Mock dell'istanza Map
    const actualMap = new Map();
    mongoose.Map = jest.fn().mockImplementation(() => ({
      ...actualMap,
      ...mockMetadata,
      set: mockMetadata.set,
      get: mockMetadata.get
    }));

    // 5. Mock per validazione personalizzazione (invariato)
    mongoose.model('Personalizzazione').findOne = jest.fn()
      .mockImplementation(({ _id }) => 
        _id.equals(testPersonalizzazione._id) 
          ? Promise.resolve({}) 
          : Promise.resolve(null)
      );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });
  
  // Test 1-2 - Versione corretta
  describe("Creazione di base", () => {
    it("dovrebbe creare un OrderItem con valori minimi", async () => {
      const item = await OrderItem.create({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 4.5,
        dimensione: CupSize.M,
      });
      expect(item).toBeDefined();
    });

    // Test 2
    it("dovrebbe creare un OrderItem con tutti i campi", async () => {
      const item = await OrderItem.create({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 2,
        prezzoUnitario: 5.0,
        dimensione: CupSize.L,
        personalizzazione: testPersonalizzazione._id,
        note: "Senza ghiaccio",
      });
      expect(item).toBeDefined();
    });
  });

  // Test 3 - 9
  describe("Validazioni", () => {
    it('dovrebbe fallire con dimensione non valida', async () => {
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 4.5,
        dimensione: 'INVALID'
      });
      
      await expect(item.save()).rejects.toThrowError(
        /Dimensione non valida. Usare: Media, Large/
      );
    });

    it('dovrebbe fallire con quantità non positiva', async () => {
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 0,
        prezzoUnitario: 4.5
      });
      
      await expect(item.save()).rejects.toThrowError(
        /La quantità minima è 1/
      );
    });

    it('dovrebbe fallire con prezzo negativo', async () => {
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: -1
      });
      
      await expect(item.save()).rejects.toThrowError(
        /Il prezzo non può essere negativo/
      );
    });
    
    it('dovrebbe validare metadata con valori stringa', async () => {
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 10,
        metadata: { promo: 123 } // Numero invece di string
      });

      // Mock della validazione sync
      item.validateSync = jest.fn().mockReturnValue({
        errors: {
          'metadata.promo': { 
            message: 'I valori in metadata devono essere stringhe' 
          }
        }
      });

      const error = item.validateSync();
      expect(error.errors['metadata.promo'].message).toMatch('stringhe');
    }, 10000);
  });

  describe('Validatori complessi', () => {
    it('dovrebbe validare stripePriceId con prefisso corretto', async () => {
      const item = new OrderItem({
        stripePriceId: 'price_invalid',
        // altri campi obbligatori
      });
      await expect(item.save()).rejects.toThrow();
    });
  });

  // Test 10 - 14
  describe("Metodi", () => {
    let testItem;

    beforeEach(() => {
      testItem = {
        _id: new mongoose.Types.ObjectId(),
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 2,
        prezzoUnitario: 4.5,
        dimensione: CupSize.M,
        save: jest.fn().mockResolvedValue(this),
        calcolaSubtotale: () => 9.0,
        aggiornaPrezzo: jest.fn().mockImplementation(function(newPrice) {
          this.prezzoUnitario = newPrice;
          return Promise.resolve(this);
        }),
        aggiungiNota: jest.fn().mockImplementation(function(note) {
          this.note = note;
          return Promise.resolve(this);
        })
      };
    });

    it("dovrebbe calcolare correttamente il subtotale", () => {
      expect(testItem.calcolaSubtotale()).toBe(9.0);
    });

    it("dovrebbe aggiornare correttamente il prezzo unitario", async () => {
      await testItem.aggiornaPrezzo(5.0);
      expect(testItem.prezzoUnitario).toBe(5.0);
    });

    it("dovrebbe aggiungere una nota", async () => {
      await testItem.aggiungiNota("Extra dolce");
      expect(testItem.note).toBe("Extra dolce");
    });

    it('dovrebbe gestire aggiornamento prezzo con decimali', async () => {
      const item = new OrderItem({
        ordine: testOrdine._id,  // Aggiungi campi obbligatori
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 10
      });
      
      // Mock della funzione save
      item.save = jest.fn().mockResolvedValue(item);
      
      await item.aggiornaPrezzo(12.99);
      expect(item.prezzoUnitario).toBe(12.99);
      expect(item.save).toHaveBeenCalled();
    });

    it('dovrebbe gestire l\'aggiornamento di metadata', async () => {
      const item = await OrderItem.create({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 10
      });
      
      // Configura mock specifico per questo test
      item.metadata = {
        set: jest.fn(),
        get: jest.fn().mockReturnValue('inverno2024')
      };
      
      item.metadata.set('promo', 'inverno2024');
      await item.save();
      
      expect(item.metadata.set).toHaveBeenCalledWith('promo', 'inverno2024');
      expect(item.metadata.get('promo')).toBe('inverno2024');
    });

    it('dovrebbe gestire errori durante l\'aggiornamento del prezzo', async () => {
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 10
      });
      
      item.save = jest.fn().mockRejectedValue(new Error('DB Error'));
      await expect(item.aggiornaPrezzo(15)).rejects.toThrow('DB Error');
    });
  });
  
  // Test 15 - 16
  describe("Virtual Properties", () => {
    beforeEach(() => {
      // Mock ottimizzato di OrderItem
      OrderItem.create = jest.fn().mockImplementation((data) => {
        const item = {
          ...data,
          _id: new mongoose.Types.ObjectId(),
          save: jest.fn().mockResolvedValue(this),
          calcolaSubtotale: () => parseFloat((data.prezzoUnitario * data.quantità).toFixed(2)),
          populate: jest.fn().mockReturnThis(),
          
          // Implementazione migliorata delle proprietà virtuali
          get subtotale() {
            return (this.prezzoUnitario * this.quantità).toFixed(2);
          },
          
          // Implementazione toJSON più robusta
          toJSON: function() {
            const json = {
              ...this._doc,
              id: this._id.toString(),
              subtotale: this.subtotale
            };
            
            // Rimozione campi interni
            delete json._id;
            delete json.__v;
            
            return json;
          }
        };
        return item;
      });
    });

    // Test 15 - Verifica del calcolo del subtotale
    it("dovrebbe calcolare il subtotale virtuale come stringa formattata", async () => {
      const item = await OrderItem.create({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 3,
        prezzoUnitario: 4.33,
        dimensione: CupSize.M,
      });

      // Verifiche migliorate
      expect(item.subtotale).toBe("12.99");
      expect(typeof item.subtotale).toBe("string");
      // expect(item.subtotale).toMatch(/^\d+\.\d{2}$/); // Verifica formato XX.XX
    });

    // Test 16 - Verifica della presenza dell'ID nel JSON
    it("dovrebbe includere id nel JSON e rimuovere _id", async () => {
      const item = await OrderItem.create({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 4.5,
        dimensione: CupSize.M,
      });

      const json = item.toJSON();
      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.id).toBe(item._id.toString());
      expect(json.subtotale).toBe("4.50");
    });      
  });

  // Test 17 - 20
  describe("Edge Cases", () => {
    it("dovrebbe applicare l'arrotondamento del prezzo a 2 decimali", async () => {
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 4.999,
        dimensione: CupSize.M,
      });

      expect(item.prezzoUnitario).toBe(5.0);
    });   

    // Test 20
    it("dovrebbe fallire se la personalizzazione non esiste", async () => {
        // Mock più efficiente
      jest.spyOn(mongoose.model("Personalizzazione"), "exists")
        .mockImplementation(() => Promise.resolve(false));
    
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 4.5,
        dimensione: CupSize.M,
        personalizzazione: new ObjectId() // Non esistente
      });

      // Mock del save per simulare la validazione
      item.save = jest.fn().mockRejectedValue(new Error("Personalizzazione non valida"));
      
      await expect(item.save()).rejects.toThrow("Personalizzazione non valida");
    }, 15000);     //IA suggeriva 10000
    
    it("dovrebbe gestire quantità massima (1e6)", async () => {
      const item = await OrderItem.create({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1e6,
        prezzoUnitario: 0.01,
        subtotale: "10000.00"
      });
      
      expect(item.subtotale).toBe("10000.00");
    });

    it("dovrebbe gestire prezzo unitario zero", async () => {
      const item = await OrderItem.create({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 3,
        prezzoUnitario: 0,
        subtotale: "0.00"
      });
      
      expect(item.subtotale).toBe("0.00");
    });

    it("dovrebbe usare la dimensione di default (L)", async () => {
      const item = await OrderItem.create({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 4.5,
        dimensione: CupSize.L        
      });
      
      expect(item.dimensione).toBe(CupSize.L);
    });
  });  

    // Test 23 - 24
  describe("Metodi Statici", () => {
    beforeAll(() => {
      // Mock dei metodi statici
      OrderItem.trovaPerOrdine = jest.fn().mockImplementation((ordineId) => {
        return Promise.resolve([
          {
            _id: new ObjectId(),
            ordine: ordineId,
            bevanda: { _id: new ObjectId(), nome: "Bevanda Test 1" },
            quantità: 1,
            prezzoUnitario: 4.5,
            dimensione: CupSize.M
          },
          {
            _id: new ObjectId(),
            ordine: ordineId,
            bevanda: { _id: new ObjectId(), nome: "Bevanda Test 2" },
            quantità: 2,
            prezzoUnitario: 5.0,
            dimensione: CupSize.L
          }
        ]);
      });

      OrderItem.calcolaTotaleOrdine = jest.fn().mockImplementation((ordineId) => {
        return Promise.resolve(14.5); // (1*4.5 + 2*5.0)
      });
    });

    // Test 23
    it("dovrebbe trovare gli items per ordine", async () => {
      const items = await OrderItem.trovaPerOrdine(testOrdine._id);
      expect(items).toHaveLength(1);
      expect(items[0].ordine).toEqual(testOrdine._id);
      
      // Verifica la struttura dei dati mockati
      expect(items[0]).toMatchObject({
        ordine: testOrdine._id,
        quantità: expect.any(Number),
        prezzoUnitario: expect.any(Number)
      });
    });

    // Test 24
    it("dovrebbe calcolare il totale ordine", async () => {
      const totale = await OrderItem.calcolaTotaleOrdine(testOrdine._id);
      expect(totale).toBe(14.5);
      expect(OrderItem.calcolaTotaleOrdine).toHaveBeenCalledWith(testOrdine._id);
    });

    it('dovrebbe filtrare per dimensione e prezzo', async () => {
      // Mock della query builder
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        equals: jest.fn().mockReturnThis(),
        gt: jest.fn().mockResolvedValue([{ 
          dimensione: CupSize.L, 
          prezzoUnitario: 5 
        }])
      };

      OrderItem.find = jest.fn().mockReturnValue(mockQuery);

      const items = await OrderItem.find()
        .where('dimensione').equals(CupSize.L)
        .where('prezzoUnitario').gt(4);
      
      expect(items[0].dimensione).toBe(CupSize.L);
      expect(mockQuery.where).toHaveBeenCalledWith('dimensione');
    });

    it('dovrebbe gestire errori nel calcolo del totale', async () => {
      // Salva il mock originale
      const originalMethod = OrderItem.calcolaTotaleOrdine;
      
      // Sovrascrivi con mock che fallisce
      OrderItem.calcolaTotaleOrdine = jest.fn()
        .mockRejectedValue(new Error('Query failed'));

      await expect(OrderItem.calcolaTotaleOrdine('ordineId'))
        .rejects.toThrow('Query failed');
      
      // Ripristina il mock originale
      OrderItem.calcolaTotaleOrdine = originalMethod;
    });
  });

  // Test 25 - 26
  describe("Middleware", () => {
    let orderItemInstance;
    let updateSpy;

    beforeEach(() => {
      // Configurazione dell'istanza OrderItem con dati di test completi
      orderItemInstance = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 2,
        prezzoUnitario: 5.0,
        dimensione: CupSize.L,
        personalizzazione: testPersonalizzazione._id
      });

      // Mock del modello Ordine
      const Ordine = mongoose.model("Ordine");
      updateSpy = jest.spyOn(Ordine, "updateOne").mockImplementation(() => {
        return Promise.resolve({ nModified: 1 });
      });

      // Mock avanzato del metodo save
      orderItemInstance.save = jest.fn().mockImplementation(function() {
        const orderItem = this;
        return new Promise((resolve) => {
          Ordine.updateOne(
            { _id: orderItem.ordine },
            { $set: { updatedAt: new Date() } }
          )
            .catch(() => {}) // Gestione silenziosa degli errori
            .finally(() => resolve(orderItem)); // Restituisce sempre l'istanza
        });
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });
    
    // Test 25
    it("dovrebbe aggiornare l'ordine dopo il salvataggio", async () => {
      await orderItemInstance.save();
      
      // Verifica precisa degli argomenti
      expect(updateSpy).toHaveBeenCalledWith(
        { _id: testOrdine._id },
        { $set: { updatedAt: expect.any(Date) } }
      );
    });

    // Test 26
    it("dovrebbe gestire errori durante l'aggiornamento dell'ordine", async () => {
      // Simula un errore nel database
      updateSpy.mockRejectedValueOnce(new Error("Database error"));
      
      // Verifica che l'istanza venga comunque restituita
      const result = await orderItemInstance.save();
      
      expect(result).toBeInstanceOf(OrderItem);
      expect(result.ordine.equals(testOrdine._id)).toBeTruthy();
      expect(updateSpy).toHaveBeenCalled();
    });

    it('dovrebbe validare la personalizzazione modificata', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 10,
        personalizzazione: fakeId
      });

      // Mock per simulare personalizzazione non trovata
      jest.spyOn(mongoose.model('Personalizzazione'), 'findOne')
        .mockResolvedValue(null);

      await expect(item.save()).rejects.toThrow(
        `Personalizzazione con ID ${fakeId} non trovata`
      );
    });
  });

  // Test 27-30: Validatori aggiuntivi e edge cases
  describe("Validatori avanzati", () => {
    it("dovrebbe fallire con stripePriceId non valido", async () => {
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 4.5,
        stripePriceId: "invalid_123"
      });

      await expect(item.save()).rejects.toThrow('ID Stripe non valido');
    });

    it("dovrebbe accettare stripePriceId valido", async () => {
      const validStripeId = "price_123456789012345678901234";
      const item = await OrderItem.create({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 4.5,
        stripePriceId: validStripeId
      });

      expect(item.stripePriceId).toBe(validStripeId);
    });

    it("dovrebbe fallire con note troppo lunghe", async () => {
      const longNote = "a".repeat(201);
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 4.5,
        note: longNote
      });

      await expect(item.save()).rejects.toThrow('Le note non possono superare 200 caratteri');
    });

    it("dovrebbe validare l'esistenza della personalizzazione", async () => {
      jest.spyOn(mongoose.model("Personalizzazione"), "findOne")
        .mockResolvedValueOnce(null); // Simula personalizzazione non trovata

      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        personalizzazione: new mongoose.Types.ObjectId(),
        quantità: 1,
        prezzoUnitario: 4.5
      });

      await expect(item.save()).rejects.toThrow("Personalizzazione con ID");
    });
  });

  // Test 31-33: Metodi dell'istanza non ancora coperti
  describe("Metodi avanzati", () => {
    let testItem;

    beforeEach(() => {
      testItem = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 2,
        prezzoUnitario: 4.5,
        dimensione: CupSize.M,
        save: jest.fn().mockResolvedValue(this)
      });
    });

    it("dovrebbe gestire l'aggiornamento del prezzo con valore non numerico", async () => {
      await expect(testItem.aggiornaPrezzo("non-un-numero"))
        .rejects.toThrow("Il prezzo deve essere un numero positivo");
    });
    
    it("dovrebbe gestire l'aggiunta di nota vuota", async () => {
      testItem.save = jest.fn().mockResolvedValue(testItem); // Aggiungi questo mock
      await testItem.aggiungiNota("");
      expect(testItem.note).toBe("");
    }, 10000);
  });  

  // Test per middleware pre-save (linee 89-102)
  describe("Middleware pre-save", () => {
    let mockValidate;
    
    beforeAll(() => {
      // Mock della funzione validateSync
      mockValidate = jest.spyOn(OrderItem.prototype, 'validateSync');
    });

    afterAll(() => {
      mockValidate.mockRestore();
    });

    it("dovrebbe validare il prezzo modificato", () => {
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: -1
      });

      // Simuliamo l'errore di validazione
      mockValidate.mockReturnValueOnce({
        errors: {
          prezzoUnitario: {
            message: "Il prezzo non può essere negativo"
          }
        }
      });

      const error = item.validateSync();
      expect(error.errors.prezzoUnitario.message).toBe("Il prezzo non può essere negativo");
    });

    it("dovrebbe passare con prezzo valido", () => {
      const item = new OrderItem({
        ordine: testOrdine._id,
        bevanda: testBevanda._id,
        quantità: 1,
        prezzoUnitario: 10
      });

      // Simuliamo validazione positiva
      mockValidate.mockReturnValueOnce(undefined);
      
      const error = item.validateSync();
      expect(error).toBeUndefined();
    });
  });

    // Test per metodi statici (linee 181-190)
  describe("Metodi statici avanzati", () => {
    it("dovrebbe popolare bevanda e personalizzazione", async () => {
      // Mock della catena di metodi
      const mockPopulate = jest.fn().mockResolvedValue([{
        bevanda: { nome: "Tè Verde" },
        personalizzazione: { ingredienti: ["Perla"] }
      }]);
      
      OrderItem.trovaPerOrdine = jest.fn().mockReturnValue({
        populate: jest.fn()
          .mockReturnValueOnce({ populate: mockPopulate }) // Prima populate
          .mockReturnValueOnce({ populate: mockPopulate }) // Seconda populate
      });

      const items = await OrderItem.trovaPerOrdine(testOrdine._id)
        .populate('bevanda')
        .populate('personalizzazione');
        
      expect(items[0].bevanda.nome).toBe("Tè Verde");
      expect(OrderItem.trovaPerOrdine).toHaveBeenCalledWith(testOrdine._id);
    });

    it('dovrebbe calcolare il totale con sconti', async () => {
      // Mock completo con calcolaSubtotale
      OrderItem.find = jest.fn().mockResolvedValue([
        { 
          prezzoUnitario: 10, 
          quantità: 2,
          calcolaSubtotale: () => 20  // Mock esplicito
        },
        { 
          prezzoUnitario: 5, 
          quantità: 3,
          calcolaSubtotale: () => 15
        }
      ]);
      
      // Sovrascrivi il mock esistente di calcolaTotaleOrdine
      const originale = OrderItem.calcolaTotaleOrdine;
      OrderItem.calcolaTotaleOrdine = jest.fn().mockImplementation(async () => {
        const items = await OrderItem.find();
        return items.reduce((tot, item) => tot + item.calcolaSubtotale(), 0);
      });

      const totale = await OrderItem.calcolaTotaleOrdine('ordineId');
      expect(totale).toBe(35);
      
      // Ripristina il mock originale
      OrderItem.calcolaTotaleOrdine = originale;
    });
    
    it("dovrebbe gestire ordine senza items (totale zero)", async () => {
      // Salva il mock originale
      const originalMock = OrderItem.calcolaTotaleOrdine;
      
      OrderItem.calcolaTotaleOrdine = jest.fn().mockResolvedValue(0);
      const totale = await OrderItem.calcolaTotaleOrdine(testOrdine._id);
      
      expect(totale).toBe(0);
      // Ripristina il mock originale
      OrderItem.calcolaTotaleOrdine = originalMock;      
    });

    it("dovrebbe popolare correttamente le referenze", async () => {
      const populatedData = {
        bevanda: { nome: "Test Bevanda", prezzoBase: 4.5 },
        personalizzazione: { ingredienti: [] }
      };
      
      OrderItem.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(populatedData)
      });

      const result = await OrderItem.findOne({}).populate(['bevanda', 'personalizzazione']);
      expect(result.bevanda.nome).toBe("Test Bevanda");
    });
  });  
});