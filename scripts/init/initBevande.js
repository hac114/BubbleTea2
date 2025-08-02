// backend/scripts/initBevande.js
const mongoose = require("mongoose");
const connectDB = require("../../config/db");
const Bevanda = require("../../models/Bevanda");
const { Ingrediente } = require("../../models/Ingrediente");

async function getIngredientiIds() {
  const [teNero, matcha, tapioca, vaniglia] = await Ingrediente.find()
    .sort({ nome: 1 })
    .limit(4);

  return {
    teNero: teNero._id,
    matcha: matcha._id,
    tapioca: tapioca._id,
    vaniglia: vaniglia._id,
  };
}

async function init() {
  try {
    await connectDB();
    const ids = await getIngredientiIds();

    const bevande = [
      {
        nome: "Classic Milk Tea",
        tipo: "CLASSICO",
        custom: false,
        prezzoBase: 4.5,
        ingredienti: [ids.teNero, ids.tapioca],
      },
      {
        nome: "Matcha Latte",
        tipo: "LATTE_TEA",
        custom: false,
        prezzoBase: 5.2,
        ingredienti: [ids.matcha, ids.vaniglia],
      },
    ];

    await Bevanda.deleteMany({});
    await Bevanda.insertMany(bevande);

    console.log("✅ Bevande inizializzate con successo!");
    console.log(`📊 ${await Bevanda.countDocuments()} bevande create`);
  } catch (err) {
    console.error("❌ Errore:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

init();