const mongoose = require("mongoose");
const { TeaBase, Bubble, Aroma } = require("../../models/Ingrediente");

async function init() {
  try {
    // 1. Connessione semplificata (rimossi i parametri deprecati)
    const conn = await mongoose.connect(
      "mongodb://localhost:27017/BubbleTea_2",
    );
    console.log(`✅ Connesso a MongoDB: ${conn.connection.host}`);

    // 2. Pulisci le collezioni esistenti
    await mongoose.connection.db.dropCollection("ingredienti").catch(() => {
      console.log("ℹ️ Collezione ingredienti non esistente, verrà creata");
    });

    // 3. Crea documenti senza transazione (più semplice per l'inizializzazione)
    const tèVerde = await TeaBase.create({
      nome: "Tè Verde",
      prezzoAggiuntivo: 0.5,
      livelloAmarezza: 2,
    });

    const tèNero = await TeaBase.create({
      nome: "Tè Nero",
      prezzoAggiuntivo: 0.7,
      livelloAmarezza: 4,
    });

    const bobaClassica = await Bubble.create({
      nome: "Boba Classica",
      prezzoAggiuntivo: 1.0,
      croccantezza: 2,
      vegano: false,
    });

    const bobaFrutta = await Bubble.create({
      nome: "Boba di Frutta",
      prezzoAggiuntivo: 1.2,
      croccantezza: 1,
      vegano: true,
    });

    const vaniglia = await Aroma.create({
      nome: "Vaniglia",
      prezzoAggiuntivo: 0.8,
      intensita: 3,
    });

    const mango = await Aroma.create({
      nome: "Mango",
      prezzoAggiuntivo: 0.9,
      intensita: 4,
    });

    console.log("📝 Documenti creati con successo:");
    console.log({ tèVerde, tèNero, bobaClassica, bobaFrutta, vaniglia, mango });

    // 4. Verifica finale
    const count = await mongoose.model("Ingrediente").countDocuments();
    console.log(`🔢 Totale ingredienti nel DB: ${count}`);
  } catch (err) {
    console.error("❌ Errore:", err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

init();