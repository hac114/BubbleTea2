const mongoose = require("mongoose");
const Statistica = require("../../models/Statistica");

// Configurazione di connessione - MODIFICA QUESTA PARTE!
const DB_URI = "mongodb://localhost:27017/BubbleTea_2"; // Sostituisci con il tuo DB name

async function initStatistiche() {
  try {
    console.log("🔌 Tentativo di connessione al database...");

    // Connessione al database
    await mongoose.connect(DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout più breve per debugging
    });
    console.log("✅ Connesso al database con successo!");

    console.log("⏳ Inizializzazione statistiche...");
    await Statistica.deleteMany();

    const statisticheDemo = [
      {
        tipo: "STATO_ORDINI",
        metriche: {
          ordiniInAttesa: 5,
          ordiniCompletati: 42,
          tempoMedioAttesa: 12,
          rapportoBasi: { tea: 60, teaLatte: 40 },
        },
        intervallo: "OGGI",
        sedeId: null,
      },
      {
        tipo: "INGREDIENTI_POPOLARI",
        metriche: {
          ingredientiTop: new Map([
            ["Perle di tapioca", 68],
            ["Sciroppo di vaniglia", 45],
          ]),
        },
        intervallo: "SETTIMANA_CORRENTE",
      },
    ];

    await Statistica.insertMany(statisticheDemo);
    console.log("✅ Statistiche inizializzate con successo!");

    // Chiudi la connessione
    await mongoose.disconnect();
    console.log("🔌 Connessione chiusa");
  } catch (err) {
    console.error("❌ Errore durante l'inizializzazione:", err.message);
    process.exit(1);
  }
}

initStatistiche();