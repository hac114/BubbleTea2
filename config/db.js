const mongoose = require("mongoose");

const mongoURI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/BubbleTea_2";

async function connectDB() {
  try {
    // Nuova versione senza useUnifiedTopology
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true, // Puoi mantenerlo o rimuoverlo (non dà più warning)
    });

    console.log("✅ Connesso a MongoDB");

    // Aggiunta consigliata: verifica connessione
    mongoose.connection.on("connected", () => {
      console.log("Mongoose connesso a", mongoose.connection.db.databaseName);
    });
  } catch (err) {
    console.error("❌ Errore DB:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;