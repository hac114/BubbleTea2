// ============ MOCK PERSONALIZZAZIONE ============ //
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Definizione dello schema
const personalizzazioneSchema = new Schema(
  {
    teaBases: {
      type: [Schema.Types.ObjectId],
      required: true,
      validate: [(val) => val.length > 0, "Almeno una base tea è richiesta"],
    },
    latte: Boolean,
    bubbles: [Schema.Types.ObjectId],
    aromi: [Schema.Types.ObjectId],
    dolcezza: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    ghiaccio: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Creazione modello mock
const MockModel = mongoose.model("Personalizzazione", personalizzazioneSchema);

// Implementazione metodi mock
MockModel.create = jest.fn().mockImplementation((data) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    teaBases: data.teaBases || [new mongoose.Types.ObjectId()],
    latte: data.latte || false,
    bubbles: data.bubbles || [],
    aromi: data.aromi || [],
    dolcezza: data.dolcezza || 50,
    ghiaccio: data.ghiaccio || false,
    save: jest.fn().mockResolvedValue(this),
    toObject: jest.fn().mockReturnValue(this),
  };
  return Promise.resolve(doc);
});

MockModel.findById = jest.fn().mockImplementation((id) => {
  return Promise.resolve({
    _id: id || new mongoose.Types.ObjectId(),
    teaBases: [new mongoose.Types.ObjectId()],
    latte: false,
    bubbles: [new mongoose.Types.ObjectId()],
    aromi: [],
    dolcezza: 50,
    ghiaccio: false,
    save: jest.fn().mockResolvedValue(this),
    populate: jest.fn().mockReturnThis(),
    execPopulate: jest.fn().mockResolvedValue(this),
  });
});

MockModel.exists = jest.fn().mockImplementation((query) => {
  // Restituisce true solo se viene passato un _id valido
  return Promise.resolve(!!query?._id);
});

MockModel.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });

// Aggiungi altri mock utili
MockModel.findOne = jest.fn().mockResolvedValue({
  _id: new mongoose.Types.ObjectId(),
  teaBases: [new mongoose.Types.ObjectId()],
  dolcezza: 30,
});

// Export del modello mockato
module.exports = MockModel;