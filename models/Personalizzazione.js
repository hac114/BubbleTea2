const mongoose = require("mongoose");
const { Schema } = mongoose;

const personalizzazioneSchema = new Schema(
  {
    teaBases: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Ingrediente",
          validate: {
            validator: async function (teaId) {
              try {
                console.log(
                  "[VALIDATION] Verifica teaBase con ID:",
                  teaId.toString(),
                );

                const ingrediente = await mongoose
                  .model("Ingrediente")
                  .findOne({
                    _id: teaId,
                    $or: [{ tipo: "TEA_BASE" }, { __t: "TEA_BASE" }],
                  });

                const isValid = !!ingrediente;
                console.log(`[VALIDATION] Trovato ingrediente: ${isValid}`);
                return isValid;
              } catch (err) {
                console.error("[VALIDATION ERROR]", err);
                return false;
              }
            },
            message: (props) => {
              const idStr = props.value?.toString?.() || "ID non valido";
              return `Validazione fallita per ID ${idStr}. Verifica che:
          1. L'ingrediente esista
          2. Sia di tipo TEA_BASE
          3. Il campo 'tipo' sia impostato correttamente`;
            },
          },
        },
      ],
      required: [true, "Almeno una base tea è richiesta"],
      validate: {
        validator: function (teaBases) {
          return teaBases && teaBases.length > 0;
        },
        message: "Almeno una base tea è richiesta",
      },
    },
    latte: {
      type: Boolean,
      default: false,
    },
    bubbles: [
      {
        type: Schema.Types.ObjectId,
        ref: "Ingrediente",
        validate: {
          validator: async function (bubbleId) {
            const ingrediente = await mongoose.model("Ingrediente").findOne({
              _id: bubbleId,
              $or: [{ tipo: "BUBBLE" }, { __t: "BUBBLE" }],
            });
            return !!ingrediente;
          },
          message: (props) => `ID ${props.value} non è un BUBBLE valido`,
        },
      },
    ],
    aromi: [
      {
        type: Schema.Types.ObjectId,
        ref: "Ingrediente",
        validate: {
          validator: async function (aromaId) {
            const ingrediente = await mongoose.model("Ingrediente").findOne({
              _id: aromaId,
              $or: [{ tipo: "AROMA" }, { __t: "AROMA" }],
            });
            return !!ingrediente;
          },
          message: (props) => `ID ${props.value} non è un AROMA valido`,
        },
      },
    ],
    dolcezza: {
      type: Number,
      required: true,
      min: [0, "La dolcezza minima è 0%"],
      max: [100, "La dolcezza massima è 100%"],
      default: 50,
      validate: {
        validator: Number.isInteger,
        message: "La dolcezza deve essere un numero intero",
      },
    },
    ghiaccio: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "personalizzazioni",
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
    toObject: { virtuals: true }, // Aggiunto per abilitare i virtuals
  },
);

// Validazione pre-save
personalizzazioneSchema.pre("save", function (next) {
  const MAX = 3;
  const check = (field, name) => {
    if (field?.length > MAX) {
      throw new Error(`Massimo ${MAX} ${name} consentiti`);
    }
  };

  check(this.teaBases, "tea bases");
  check(this.bubbles, "bubbles");
  check(this.aromi, "aromi");

  next();
});

// Aggiungi il campo virtuale prezzoTotale
personalizzazioneSchema.virtual('prezzoTotale').get(function() {
  let totale = 0;

  // Funzione helper migliorata
  const calcolaTotale = (ingredienti) => {
    if (!ingredienti || !ingredienti.length) return 0;
    
    // Se è già popolato (ha prezzoAggiuntivo)
    if (ingredienti[0]?.prezzoAggiuntivo !== undefined) {
      return ingredienti.reduce((sum, ing) => sum + (ing.prezzoAggiuntivo || 0), 0);
    }
    
    // Se è un ObjectId non popolato, ritorna 0
    return 0;
  };

  // Somma i prezzi di tutti i tipi di ingredienti
  totale += calcolaTotale(this.teaBases);
  totale += calcolaTotale(this.bubbles);
  totale += calcolaTotale(this.aromi);

  return totale;
});

module.exports =
  mongoose.models.Personalizzazione ||
  mongoose.model("Personalizzazione", personalizzazioneSchema);