const mongoose = require("mongoose");
const { Ingrediente } = require("../../models/Ingrediente");
const Personalizzazione = require("../../models/Personalizzazione");

async function init() {
  try {
    // 1. Configurazione connessione
    mongoose.set("debug", true);
    await mongoose.connect("mongodb://localhost:27017/BubbleTea_2", {
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });
    console.log("✅ Connesso a MongoDB");

    // 2. Verifica preliminare
    const counts = await Promise.all([
      Ingrediente.countDocuments({
        $or: [{ tipo: "TEA_BASE" }, { __t: "TEA_BASE" }],
      }),
      Ingrediente.countDocuments({
        $or: [{ tipo: "BUBBLE" }, { __t: "BUBBLE" }],
      }),
      Ingrediente.countDocuments({
        $or: [{ tipo: "AROMA" }, { __t: "AROMA" }],
      }),
    ]);

    if (counts.some((c) => c < 1)) {
      throw new Error(
        `Ingredienti insufficienti: ${counts.join("/")} (necessari 1+ per tipo)`,
      );
    }

    // 3. Recupero ingredienti con tipo garantito
    const [teabase] = await Ingrediente.find({
      $or: [{ tipo: "TEA_BASE" }, { __t: "TEA_BASE" }],
    }).limit(1);
    const [bubble] = await Ingrediente.find({
      $or: [{ tipo: "BUBBLE" }, { __t: "BUBBLE" }],
    }).limit(1);
    const [aroma] = await Ingrediente.find({
      $or: [{ tipo: "AROMA" }, { __t: "AROMA" }],
    }).limit(1);

    console.log("Ingredienti validati:", {
      teaBase: teabase.nome,
      bubble: bubble.nome,
      aroma: aroma.nome,
    });

    // 4. Creazione personalizzazione
    const personalizzazione = await Personalizzazione.create({
      teaBases: [teabase._id],
      latte: true,
      bubbles: [bubble._id],
      aromi: [aroma._id],
      dolcezza: 50,
      ghiaccio: false,
    });

    console.log("✅ Personalizzazione creata con successo!");
    console.log("ID:", personalizzazione._id);

    // 5. Verifica con populate
    const verificata = await Personalizzazione.findById(personalizzazione._id)
      .populate("teaBases", "nome tipo")
      .populate("bubbles", "nome tipo")
      .populate("aromi", "nome tipo")
      .lean();

    console.log("Dettagli:", {
      dolcezza: `${verificata.dolcezza}%`,
      ghiaccio: verificata.ghiaccio ? "Con ghiaccio" : "Senza ghiaccio",
      teaBases: verificata.teaBases.map((t) => t.nome),
      bubbles: verificata.bubbles.map((b) => b.nome),
      aromi: verificata.aromi.map((a) => a.nome),
    });
  } catch (err) {
    console.error("\n❌ ERRORE:", err.message);
    if (err.errors) {
      console.error("Dettagli validazione:");
      Object.entries(err.errors).forEach(([field, error]) => {
        console.error(`- ${field}: ${error.message}`);
      });
    }
  } finally {
    await mongoose.disconnect();
    console.log("\nConnessione chiusa");
  }
}

init();