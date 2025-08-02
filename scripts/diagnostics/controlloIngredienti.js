const mongoose = require("mongoose");
const { Ingrediente } = require("../../models/Ingrediente");

async function checkIngredients() {
  try {
    // 1. Connessione al database
    await mongoose.connect("mongodb://localhost:27017/BubbleTea_2");
    console.log("✅ Connesso a MongoDB");

    // 2. Cerca gli ingredienti specifici
    const ingredients = await Ingrediente.find({
      $or: [
        { nome: "Tè Verde", tipo: "TEA_BASE" },
        { nome: "Boba Classica", tipo: "BUBBLE" },
        { nome: "Vaniglia", tipo: "AROMA" },
      ],
    });

    // 3. Stampa i risultati
    if (ingredients.length === 0) {
      console.log("❌ Nessun ingrediente trovato");
    } else {
      console.log("✅ Ingredienti trovati:");
      ingredients.forEach((ing) => {
        console.log(`- ${ing.nome} (${ing.tipo}): ${ing._id}`);
      });
    }
  } catch (err) {
    console.error("❌ Errore:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

checkIngredients();