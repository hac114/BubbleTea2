const mongoose = require("mongoose");

const tavoloSchema = new mongoose.Schema(
  {
    qrCode: {
      type: String,
      unique: true, // Indice univoco
      required: true,
    },
    stato: {
      type: String,
      enum: ["disponibile", "occupato", "prenotato"], // Controllo dei valori
      default: "disponibile",
    },
    numeroTavolo: {
      type: String,
      required: true,
    },
    zona: {
      type: String,
      required: true,
      index: true, // Indice per ottimizzare query per zona
    },
  },
  {
    timestamps: true, // Aggiunge createdAt e updatedAt
    collection: "tavoli", // Nome personalizzato della collezione
  },
);

// Aggiungi altri indici se necessario
tavoloSchema.index({ numeroTavolo: 1, zona: 1 }); // Esempio: indice composto

// Esporta il modello con il nome corretto della collezione
module.exports = mongoose.model("Tavolo", tavoloSchema);