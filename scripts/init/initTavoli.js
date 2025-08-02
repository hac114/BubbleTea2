const connectDB = require("../../config/db");
const Tavolo = require("../../models/Tavolo");

async function init() {
  await connectDB();

  // Cancella tutto (opzionale, solo per reset)
  await Tavolo.deleteMany({});

  // Aggiungi dati di esempio
  await Tavolo.insertMany([
    { qrCode: "T1_QR", numeroTavolo: "1", zona: "Terrazza" },
    { qrCode: "T2_QR", numeroTavolo: "2", zona: "Interno", stato: "occupato" },
  ]);

  console.log("Dati inizializzati!");
  process.exit(0);
}

init().catch((err) => console.error("Errore:", err));