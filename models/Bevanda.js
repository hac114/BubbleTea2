// backend/models/Bevanda.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const bevandaSchema = new Schema(
  {
    nome: {
      type: String,
      required: [true, "Il nome è obbligatorio"],
      trim: true,
      minlength: [2, "Il nome deve avere almeno 2 caratteri"],
      maxlength: [50, "Il nome non può superare 50 caratteri"],
      match: [/^[A-Za-z0-9\sèéàùò]+$/, "Caratteri non ammessi nel nome"],
    },
    tipo: {
      type: String,
      required: true,
      enum: {
        values: ["CLASSICO", "FRUTTATO", "LATTE_TEA", "SPECIAL"],
        message: "Tipo bevanda non valido",
      },
    },
    custom: {
      type: Boolean,
      default: false,
    },
    prezzoBase: {
      type: Number,
      required: true,
      min: [0.5, "Il prezzo non può essere inferiore a 0.50€"],
      max: [20, "Il prezzo non può superare 20€"],
      set: (v) => parseFloat(v.toFixed(2)), // Arrotonda a 2 decimali
    },
    ingredienti: [
      {
        type: Schema.Types.ObjectId,
        ref: "Ingrediente",
        validate: {
          validator: async function (v) {
            const ingrediente = await mongoose.model("Ingrediente").findById(v);
            return ingrediente !== null;
          },
          message: "Ingrediente non valido",
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "bevande",
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Validazione custom: bevande preconfigurate devono avere ingredienti
bevandaSchema.pre("save", function (next) {
  if (!this.custom && this.ingredienti.length === 0) {
    throw new Error(
      "Le bevande preconfigurate richiedono almeno 1 ingrediente",
    );
  }
  next();
});

module.exports = mongoose.model("Bevanda", bevandaSchema);