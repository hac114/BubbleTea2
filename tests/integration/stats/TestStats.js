// backend/testStats.js
const StatsCalculator = require("../../../controllers/stats/calculator");
const mongoose = require("mongoose");

// Configura la connessione al DB (usa la tua stringa di connessione)
mongoose.connect("mongodb://localhost:27017/nomeDelTuoDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Funzione per testare
async function test() {
  try {
    console.log("=== TEST CALCOLO STATISTICHE ===");

    // 1. Test calcolo statistiche ordini
    const statsOrdini = await StatsCalculator.calcolaStatisticheOrdini();
    console.log("Statistiche ordini:", statsOrdini);

    // 2. Test ingredienti popolari
    const ingredientiPopolari =
      await StatsCalculator.calcolaIngredientiPopolari();
    console.log("Ingredienti popolari:", ingredientiPopolari);

    // 3. Test generazione completa
    const risultatoFinale = await StatsCalculator.generaTutteLeStatistiche();
    console.log("Risultato finale:", risultatoFinale);
  } catch (error) {
    console.error("ERRORE DURANTE IL TEST:", error);
  } finally {
    mongoose.disconnect();
  }
}

// Esegui il test
test();