// ============ MOCK ORDINE ============ //
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Schema definizione (come nel tuo originale)
const ordineSchema = new Schema(
  {
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: "OrderItem",
        required: true,
      },
    ],
    stato: {
      type: String,
      enum: [
        "IN_ATTESA",
        "PAGAMENTO_PENDENTE",
        "IN_PREPARAZIONE",
        "COMPLETATO",
        "RITIRATO",
        "ANNULLATO",
      ],
      default: "IN_ATTESA",
    },
    totale: {
      type: Number,
      min: 0,
      required: true,
    },
    tavolo: {
      type: Schema.Types.ObjectId,
      ref: "Tavolo",
    },
  },
  {
    timestamps: true,
  },
);

// Creazione del modello mock
const MockModel = mongoose.model("Ordine", ordineSchema);

// Implementazione dei metodi mock
MockModel.create = jest.fn().mockImplementation((data) => {
  const defaultData = {
    _id: new mongoose.Types.ObjectId(),
    items: [],
    stato: "IN_ATTESA",
    totale: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
  };
  return Promise.resolve({ ...defaultData, ...data });
});

MockModel.findById = jest.fn().mockImplementation((id) => {
  const doc = {
    _id: id || new mongoose.Types.ObjectId(),
    items: [],
    stato: "IN_ATTESA",
    totale: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
    populate: jest.fn().mockImplementation(function (path) {
      if (path === "items") {
        this.items = [];
      }
      return this;
    }),
    execPopulate: jest.fn().mockResolvedValue(this),
  };
  return Promise.resolve(doc);
});

MockModel.findOne = jest.fn().mockResolvedValue({
  _id: new mongoose.Types.ObjectId(),
  stato: "COMPLETATO",
});

MockModel.updateOne = jest.fn().mockResolvedValue({ nModified: 1 });

// Aggiungi altri mock necessari
MockModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
MockModel.countDocuments = jest.fn().mockResolvedValue(1);

// Export come modulo CommonJS
module.exports = MockModel;