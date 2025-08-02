// backend/scripts/cleanDb.js
const mongoose = require("mongoose");

async function cleanup() {
  try {
    await mongoose.connect("mongodb://localhost:27017/BubbleTea_2", {
      serverSelectionTimeoutMS: 5000,
    });

    // Lista completa delle collezioni attese
    const targetCollections = [
      "tavoli",
      "clienti",
      "ingredienti",
      "bevande",
      "personalizzazioni",
      "orderItems",
      "ordini",
      "pagamenti",
    ];

    // Ottieni solo le collezioni esistenti
    const existingCollections = (
      await mongoose.connection.db.listCollections().toArray()
    )
      .map((coll) => coll.name)
      .filter((name) => targetCollections.includes(name));

    // Cancellazione mirata
    for (const collName of existingCollections) {
      await mongoose.connection.db.dropCollection(collName);
      console.log(`✅ Collezione '${collName}' cancellata`);
    }

    // Notifica per collezioni non trovate (opzionale)
    const missingCollections = targetCollections.filter(
      (name) => !existingCollections.includes(name),
    );
    if (missingCollections.length > 0) {
      console.log("\nℹ️ Collezioni non presenti:");
      missingCollections.forEach((name) => console.log(`- ${name}`));
    }
  } catch (err) {
    console.error("❌ Errore durante la pulizia:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔄 Database pronto per la reinizializzazione");
  }
}

cleanup();