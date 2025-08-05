const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Ordine = require('../../../models/Ordine');
const OrderItem = require('../../../models/OrderItem');
const Tavolo = require('../../../models/Tavolo');
const Bevanda = require('../../../models/Bevanda');
const Personalizzazione = require('../../../models/Personalizzazione');
const Ingrediente = require('../../../models/Ingrediente');
const CupSize = require('../../../enums/CupSize');
const StatoOrdine = require('../../../enums/StatoOrdine');

let mongoServer;
let ordine, tavolo, bevanda, ingrediente, personalizzazione;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  // Creazione in ordine di dipendenza
  ingrediente = await Ingrediente.create({
    nome: "Base Tea",
    tipo: "TEA_BASE",
    prezzoAggiuntivo: 0.5
  });

  personalizzazione = await Personalizzazione.create({
    teaBases: [ingrediente._id],
    dolcezza: 50
  });

  bevanda = await Bevanda.create({
    nome: "Tè Matcha",
    tipo: "CLASSICO",
    prezzoBase: 4.50,
    ingredienti: [ingrediente._id]
  });

  tavolo = await Tavolo.create({
    qrCode: 'qr_test_123',
    numeroTavolo: "T1",
    zona: "Test"
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Ordine.deleteMany({});
  await OrderItem.deleteMany({});
  
  ordine = await Ordine.create({
    tavolo: tavolo._id,
    items: [],
    totale: 0,
    stato: StatoOrdine.IN_ATTESA
  });
});

describe('Test Ordine completi', () => {
  test('1. Creazione ordine base', async () => {
    expect(ordine._id).toBeDefined();
    expect(ordine.tavolo.toString()).toBe(tavolo._id.toString());
  });

  test('2. Aggiunta item semplice', async () => {
    const item = await OrderItem.create({
      ordine: ordine._id,
      bevanda: bevanda._id,
      quantità: 1,
      prezzoUnitario: 5.00,
      dimensione: CupSize.L
    });
    
    ordine.items.push(item._id);
    await ordine.save();
    
    const ordineAggiornato = await Ordine.findById(ordine._id);
    expect(ordineAggiornato.items.length).toBe(1);
  });

  test('3. Virtual property numeroItems', () => {
    const ordineVirtual = new Ordine({
      tavolo: tavolo._id,
      items: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      totale: 0,
      stato: StatoOrdine.IN_ATTESA
    });
    
    expect(ordineVirtual.numeroItems).toBe(2);
  });

  test('4. Aggiunta item con personalizzazione', async () => {
    // Creazione item con personalizzazione
    const itemData = {
      ordine: ordine._id,
      bevanda: bevanda._id,
      personalizzazione: personalizzazione._id,
      quantità: 2,
      prezzoUnitario: 5.50,
      dimensione: CupSize.M
    };

    // Inserimento diretto con validazione disabilitata
    const item = await OrderItem.create(itemData);
    
    // Aggiornamento ordine
    ordine.items.push(item._id);
    await ordine.save();

    // Popolazione esplicita
    const ordinePopolato = await Ordine.findById(ordine._id)
      .populate({
        path: 'items',
        populate: [
          {
            path: 'personalizzazione',
            model: 'Personalizzazione',
            populate: {
              path: 'teaBases',
              model: 'Ingrediente'
            }
          },
          {
            path: 'bevanda',
            model: 'Bevanda'
          }
        ]
      });

    // Verifiche
    expect(ordinePopolato.items[0]).toBeDefined();
    expect(ordinePopolato.items[0].personalizzazione).toBeDefined();
    expect(ordinePopolato.items[0].personalizzazione._id.toString())
      .toEqual(personalizzazione._id.toString());
    expect(ordinePopolato.items[0].bevanda.nome).toBe("Tè Matcha");
  });
});