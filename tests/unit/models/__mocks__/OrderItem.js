// MOCK OrderItem per i test
const OrderItem = {
  schema: {
    path: jest.fn().mockImplementation((path) => ({
      isRequired: path === 'personalizzazione' ? true : false
    }))
  },

  create: jest.fn().mockImplementation((data) => {
    const item = {
      ...data,
      _id: new mongoose.Types.ObjectId(),
      save: jest.fn().mockImplementation(function() {
        return Promise.resolve(this);
      }),
      calcolaSubtotale: jest.fn().mockReturnValue(
        parseFloat((data.prezzoUnitario * data.quantità).toFixed(2))
      ),
      get subtotale() {
        return (this.prezzoUnitario * this.quantità).toFixed(2);
      },
      toJSON: jest.fn().mockImplementation(function() {
        return {
          ...this._doc,
          id: this._id.toString(),
          subtotale: this.subtotale
        };
      }),
      populate: jest.fn().mockReturnThis()
    };

    // Mock dei metodi
    item.aggiornaPrezzo = jest.fn().mockImplementation(function(nuovoPrezzo) {
      if (nuovoPrezzo < 0) {
        return Promise.reject(new Error("Il prezzo deve essere un numero positivo"));
      }
      this.prezzoUnitario = parseFloat(nuovoPrezzo.toFixed(2));
      return Promise.resolve(this);
    });

    item.aggiungiNota = jest.fn().mockImplementation(function(testo) {
      if (testo.length > 200) {
        return Promise.reject(new Error("La nota deve essere una stringa di massimo 200 caratteri"));
      }
      this.note = testo;
      return Promise.resolve(this);
    });

    return item;
  }),

  // Metodi statici mockati
  trovaPerOrdine: jest.fn().mockImplementation((ordineId) => {
    return Promise.resolve([
      { 
        _id: new mongoose.Types.ObjectId(),
        ordine: ordineId,
        bevanda: { _id: new mongoose.Types.ObjectId(), nome: "Bevanda 1" },
        quantità: 1,
        prezzoUnitario: 4.5
      },
      { 
        _id: new mongoose.Types.ObjectId(),
        ordine: ordineId,
        bevanda: { _id: new mongoose.Types.ObjectId(), nome: "Bevanda 2" },
        quantità: 2,
        prezzoUnitario: 5.0
      }
    ]);
  }),

  calcolaTotaleOrdine: jest.fn().mockImplementation((ordineId) => {
    return Promise.resolve(14.5); // (1*4.5 + 2*5.0)
  }),

  // Middleware mock
  post: jest.fn()
};

// Mock dello schema
OrderItem.schema.pre = jest.fn();
OrderItem.schema.post = jest.fn();
OrderItem.schema.methods = {
  calcolaSubtotale: jest.fn(),
  aggiornaPrezzo: jest.fn(),
  aggiungiNota: jest.fn()
};
OrderItem.schema.statics = {
  trovaPerOrdine: jest.fn(),
  calcolaTotaleOrdine: jest.fn()
};

module.exports = OrderItem;