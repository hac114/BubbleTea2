const mongoose = require("mongoose");
const {
  Ingrediente,
  TeaBase,
  Bubble,
  Aroma,
} = require("../../models/Ingrediente");
const Personalizzazione = require("../../models/Personalizzazione"); // Vecchio modello

async function migrate() {
  await mongoose.connect("mongodb://localhost:27017/nome_db");

  // 1. Migra le TEA_BASE
  const oldTeaBases = await Personalizzazione.find({ tipo: "TEA_BASE" });
  for (const oldDoc of oldTeaBases) {
    await TeaBase.create({
      nome: oldDoc.nome,
      prezzoAggiuntivo: oldDoc.prezzoAggiuntivo,
      livelloAmarezza: oldDoc.livelloAmarezza || 3, // Default se mancante
    });
  }

  // 2. Migra BUBBLE e AROMA (se presenti)
  // ... (logica simile, adattando i campi)

  // 3. Elimina i vecchi documenti (OPZIONALE)
  await Personalizzazione.deleteMany({
    tipo: { $in: ["TEA_BASE", "BUBBLE", "AROMA"] },
  });

  console.log("✅ Migrazione completata!");
  process.exit();
}

migrate().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});