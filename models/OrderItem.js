const mongoose = require("mongoose");
const { Schema } = mongoose;
const CupSize = require("../enums/CupSize"); // Importa l'enum

const orderItemSchema = new Schema(
  {
    ordine: {
      type: Schema.Types.ObjectId,
      ref: "Ordine",
      required: true,
      index: true,
    },
    bevanda: {
      type: Schema.Types.ObjectId,
      ref: "Bevanda",
      required: true,
    },
    personalizzazione: {
      type: Schema.Types.ObjectId,
      ref: "Personalizzazione",
      validate: {
        validator: async function (v) {
          if (!v) return true;
          try {
            const doc = await mongoose
              .model("Personalizzazione")
              .findOne({ _id: v });
            return doc !== null;
          } catch (err) {
            return false;
          }
        },
        message: (props) =>
          `Personalizzazione con ID ${props.value} non trovata`,
      },
    },
    quantità: {
      type: Number,
      required: true,
      default: 1,
      min: [1, "La quantità minima è 1"],
      validate: {
        validator: Number.isInteger,
        message: "La quantità deve essere un numero intero",
      },
    },
    prezzoUnitario: {
      type: Number,
      required: true,
      min: [0, "Il prezzo non può essere negativo"],
      set: (v) => parseFloat(v.toFixed(2)),
    },
    dimensione: {
      type: String,
      enum: {
        values: Object.values(CupSize), // Usa i valori dall'enum
        message: `Dimensione non valida. Usare: ${Object.values(CupSize).join(", ")}`,
      },
      required: true,
      default: CupSize.L, // Usa il valore di default dall'enum
    },
    note: {
      type: String,
      maxlength: [200, "Le note non possono superare 200 caratteri"],
      trim: true,
    },
    stripePriceId: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^price_[a-zA-Z0-9]{24,}$/.test(v);
        },
        message:
          'ID Stripe non valido. Deve iniziare con "price_" e contenere almeno 24 caratteri',
      },
      trim: true,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
    collection: "orderItems",
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        ret.subtotale = doc.subtotale;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Virtual per il subtotale (calcolato al volo)
orderItemSchema.virtual("subtotale").get(function () {
  return (this.prezzoUnitario * this.quantità).toFixed(2);
});

// Metodi dell'istanza
orderItemSchema.methods = {
  calcolaSubtotale() {
    return parseFloat((this.prezzoUnitario * this.quantità).toFixed(2));
  },

  async aggiornaPrezzo(nuovoPrezzo) {
    if (typeof nuovoPrezzo !== "number" || nuovoPrezzo < 0) {
      throw new Error("Il prezzo deve essere un numero positivo");
    }
    this.prezzoUnitario = parseFloat(nuovoPrezzo.toFixed(2));
    return this.save();
  },

  async aggiungiNota(testo) {
    if (typeof testo !== "string" || testo.length > 200) {
      throw new Error(
        "La nota deve essere una stringa di massimo 200 caratteri",
      );
    }
    this.note = testo;
    return this.save();
  },
};

// Middleware pre-save per validazioni aggiuntive
orderItemSchema.pre("save", async function (next) {
  // Validazione prezzo
  if (this.isModified("prezzoUnitario") && this.prezzoUnitario < 0) {
    throw new Error("Il prezzo non può essere negativo");
  }

  // Validazione personalizzazione
  if (this.isModified("personalizzazione") && this.personalizzazione) {
    try {
      const exists = await mongoose
        .model("Personalizzazione")
        .exists({ _id: this.personalizzazione });
      if (!exists) {
        throw new Error("Personalizzazione non valida");
      }
    } catch (err) {
      throw new Error("Errore durante la validazione della personalizzazione");
    }
  }

  next();
});

// Middleware post-save per aggiornare l'ordine correlato
orderItemSchema.post("save", async function (doc) {
  try {
    await mongoose
      .model("Ordine")
      .updateOne({ _id: doc.ordine }, { $set: { updatedAt: new Date() } });
  } catch (err) {
    console.error("Errore durante l'aggiornamento dell'ordine:", err);
  }
});

// Index composto per migliorare le query frequenti
orderItemSchema.index({ ordine: 1, bevanda: 1 });
orderItemSchema.index({ "metadata.promo": 1 }, { sparse: true });
orderItemSchema.index({ dimensione: 1, prezzoUnitario: 1 });

// Aggiunta di metodi statici
orderItemSchema.statics = {
  async trovaPerOrdine(ordineId) {
    return this.find({ ordine: ordineId })
      .populate("bevanda", "nome prezzoBase")
      .populate("personalizzazione", "-__v -createdAt -updatedAt")
      .lean();
  },

  async calcolaTotaleOrdine(ordineId) {
    const items = await this.find({ ordine: ordineId });
    return items.reduce((totale, item) => {
      return totale + item.calcolaSubtotale();
    }, 0);
  },
};

module.exports = mongoose.model("OrderItem", orderItemSchema);