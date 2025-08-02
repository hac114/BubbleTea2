const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Personalizzazione = require('../../../models/Personalizzazione');
const Ingrediente = require('../../../models/Ingrediente');

describe('Personalizzazione Model', () => {
  let mongoServer;
  let teaBase1, bubble1, aroma1;

  beforeAll(async () => {
    // Avvia DB in memoria
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });

    // Pulisci il database e rimuovi eventuali indici unici
    await mongoose.connection.db.dropDatabase();
    try {
      await mongoose.connection.collection('ingredienti').dropIndex('nome_1');
    } catch (err) {
      console.log('Indice nome_1 non presente o già rimosso');
    }

    // Crea dati di test con nomi unici
    const timestamp = Date.now();
    [teaBase1, bubble1, aroma1] = await Ingrediente.create([
      { nome: `Oolong-${timestamp}`, tipo: 'TEA_BASE', prezzoAggiuntivo: 1.5 },
      { nome: `Tapioca-${timestamp}`, tipo: 'BUBBLE', prezzoAggiuntivo: 0.5 },
      { nome: `Vaniglia-${timestamp}`, tipo: 'AROMA', prezzoAggiuntivo: 0.3 }
    ]);
  });

  beforeEach(async () => {
    // Pulisci solo le personalizzazioni prima di ogni test
    await Personalizzazione.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Validazioni', () => {
    it('dovrebbe richiedere almeno una teaBase', async () => {
      const p = new Personalizzazione({ dolcezza: 50 });
      await expect(p.save()).rejects.toThrow(/Almeno una base tea è richiesta/);
    });

    it('dovrebbe accettare una teaBase valida', async () => {
      const p = new Personalizzazione({
        teaBases: [teaBase1._id],
        dolcezza: 50
      });
      const saved = await p.save();
      expect(saved.teaBases[0].toString()).toBe(teaBase1._id.toString());
    });
  });

  describe('Custom Validators', () => {
    it('dovrebbe limitare a max 3 teaBases', async () => {
      const teaBases = Array(4).fill(teaBase1._id);
      const p = new Personalizzazione({ teaBases, dolcezza: 50 });
      await expect(p.save()).rejects.toThrow(/Massimo 3 tea bases consentiti/);
    });
  });

  describe('Virtuals', () => {
    it('dovrebbe calcolare correttamente prezzoTotale', async () => {
      // Crea nuova istanza per evitare conflitti
      const [teaBase, bubble, aroma] = await Ingrediente.create([
        { nome: `Oolong-${Date.now()}`, tipo: 'TEA_BASE', prezzoAggiuntivo: 1.5 },
        { nome: `Tapioca-${Date.now()}`, tipo: 'BUBBLE', prezzoAggiuntivo: 0.5 },
        { nome: `Vaniglia-${Date.now()}`, tipo: 'AROMA', prezzoAggiuntivo: 0.3 }
      ]);

      const p = await Personalizzazione.create({
        teaBases: [teaBase._id],
        bubbles: [bubble._id],
        aromi: [aroma._id],
        dolcezza: 50
      });

      // Popola esplicitamente gli ingredienti
      const populated = await Personalizzazione.findById(p._id)
        .populate('teaBases')
        .populate('bubbles')
        .populate('aromi')
        .exec();

      // Debug
      console.log('Dettagli calcolo:', {
        teaBases: populated.teaBases[0] ? {
          nome: populated.teaBases[0].nome,
          prezzo: populated.teaBases[0].prezzoAggiuntivo
        } : null,
        bubbles: populated.bubbles[0] ? {
          nome: populated.bubbles[0].nome,
          prezzo: populated.bubbles[0].prezzoAggiuntivo
        } : null,
        aromi: populated.aromi[0] ? {
          nome: populated.aromi[0].nome,
          prezzo: populated.aromi[0].prezzoAggiuntivo
        } : null,
        calculatedTotal: populated.prezzoTotale
      });

      expect(populated.prezzoTotale).toBeCloseTo(2.3); // 1.5 + 0.5 + 0.3
    });
  });
});