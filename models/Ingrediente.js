// backend/models/Ingrediente.js
const mongoose = require("mongoose");

const ingredienteSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      validate: {
        validator: (v) => v.length >= 2 && v.length <= 50,
        message: "Il nome deve essere tra 2 e 50 caratteri",
      },
    },
    prezzoAggiuntivo: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      get: (v) => parseFloat(v.toFixed(2)),
    },
    tipo: {
      type: String,
      enum: ["TEA_BASE", "BUBBLE", "AROMA"],
      required: true,
    },
    conteggioUtilizzi: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    discriminatorKey: "tipo",
    collection: "ingredienti",
    toJSON: { getters: true },
  },
);

// Modello base
const Ingrediente = mongoose.model("Ingrediente", ingredienteSchema);

// Modelli derivati (usando discriminators)
const TeaBase = Ingrediente.discriminator(
  "TEA_BASE",
  new mongoose.Schema({
    livelloAmarezza: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
  }),
);

const Bubble = Ingrediente.discriminator(
  "BUBBLE",
  new mongoose.Schema({
    croccantezza: {
      type: Number,
      min: 1,
      max: 3,
      default: 2,
    },
    vegano: {
      type: Boolean,
      default: false,
    },
  }),
);

const Aroma = Ingrediente.discriminator(
  "AROMA",
  new mongoose.Schema({
    intensita: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
  }),
);

// Esporta il modello principale e i discriminators
module.exports.Ingrediente = Ingrediente;
module.exports.TeaBase = TeaBase;
module.exports.Bubble = Bubble;
module.exports.Aroma = Aroma;

// Esporta anche solo il modello base per compatibilità
module.exports = Ingrediente;