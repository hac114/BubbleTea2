// backend/models/Cliente.js
const mongoose = require("mongoose");

const clienteSchema = new mongoose.Schema(
  {
    tavoloAssociato: {
      type: mongoose.Schema.Types.ObjectId, // Riferimento al modello Tavolo
      ref: "Tavolo", // 👈 Relazione con la collezione 'tavoli'
      required: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true, // Garantisce sessionId univoco
    },
  },
  {
    timestamps: true, // Aggiunge createdAt e updatedAt
    collection: "clienti", // 👈 Forza il nome della collezione a 'clienti'
  },
);

// Aggiungi indici se necessari (es. per ricerche frequenti)
clienteSchema.index({ tavoloAssociato: 1 }); // Ottimizza query per tavolo

module.exports = mongoose.model("Cliente", clienteSchema);