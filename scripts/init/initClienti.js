// backend/scripts/initClienti.js
const mongoose = require("mongoose");
const connectDB = require("../../config/db");
const Cliente = require("../../models/Cliente");
const Tavolo = require("../../models/Tavolo");

async function init() {
  await connectDB();
  // Cancella dati esistenti (opzionale)
  await Cliente.deleteMany({});

  // Recupera un tavolo esistente
  const tavoloEsistente = await Tavolo.findOne(); // Prende il primo tavolo disponibile

  if (!tavoloEsistente) {
    throw new Error("Nessun tavolo trovato nel database. Creane uno prima.");
  }

  // Aggiungi clienti di esempio (modifica con i tuoi dati)
  await Cliente.create([
    {
      sessionId: "sess_123",
      tavoloAssociato: "687f9c1fe1a458584a49e9f6", // Sostituisci con ID tavolo esistente
    },
  ]);

  console.log("✅ Collezione 'clienti' inizializzata!");
  process.exit(0);
}

init().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});