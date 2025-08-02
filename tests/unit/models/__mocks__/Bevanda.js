// ============ MOCK BEVANDA ============ //
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Definizione dello schema
const bevandaSchema = new Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    prezzoBase: {
      type: Number,
      required: true,
      min: 0.5,
      max: 20,
    },
    custom: {
      type: Boolean,
      default: false,
    },
    categoria: {
      type: String,
      enum: ["CLASSICO", "SPECIALE", "STAGIONALE"],
      default: "CLASSICO",
    },
    ingredienti: [
      {
        type: Schema.Types.ObjectId,
        ref: "Ingrediente",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Aggiunta virtual property
bevandaSchema.virtual("prezzoIva").get(function () {
  return (this.prezzoBase * 1.22).toFixed(2);
});

// Creazione modello mock
const MockModel = mongoose.model("Bevanda", bevandaSchema);

// Implementazione metodi mock
MockModel.create = jest.fn().mockImplementation((data) => {
  const defaultData = {
    _id: new mongoose.Types.ObjectId(),
    nome: "Bubble Tea Classico",
    prezzoBase: 4.5,
    custom: false,
    categoria: "CLASSICO",
    ingredienti: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
    toJSON: jest.fn().mockReturnValue(this),
  };
  return Promise.resolve({ ...defaultData, ...data });
});

MockModel.findById = jest.fn().mockImplementation((id) => {
  const doc = {
    _id: id || new mongoose.Types.ObjectId(),
    nome: "Bubble Tea Test",
    prezzoBase: 4.5,
    custom: false,
    categoria: "CLASSICO",
    ingredienti: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
    populate: jest.fn().mockReturnThis(),
    execPopulate: jest.fn().mockResolvedValue(this),
    toJSON: jest.fn().mockReturnValue(this),
  };
  return Promise.resolve(doc);
});

MockModel.findOne = jest.fn().mockResolvedValue({
  _id: new mongoose.Types.ObjectId(),
  nome: "Bubble Tea Esotico",
  prezzoBase: 5.5,
});

MockModel.find = jest.fn().mockResolvedValue([
  {
    _id: new mongoose.Types.ObjectId(),
    nome: "Bubble Tea Classico",
    prezzoBase: 4.5,
  },
  {
    _id: new mongoose.Types.ObjectId(),
    nome: "Bubble Tea Fruttato",
    prezzoBase: 5.0,
  },
]);

MockModel.countDocuments = jest.fn().mockResolvedValue(2);

// Export del modello mockato
module.exports = MockModel;