// backend/scripts/initOrdini.js
const mongoose = require("mongoose");
const Ordine = require("../../models/Ordine");
const Tavolo = require("../../models/Tavolo");

mongoose
  .connect("mongodb://localhost:27017/BubbleTea_2")
  .then(async () => {
    // Crea un tavolo fittizio se non esiste
    const tavolo =
      (await Tavolo.findOne()) ||
      (await Tavolo.create({
        qrCode: "tavolo-1",
        stato: "occupato",
        numeroTavolo: "1",
      }));

    await Ordine.create({
      tavolo: tavolo._id,
      totale: 0, // Verrà aggiornato quando aggiungi items
      stato: "IN_ATTESA",
    });

    console.log("Ordine inizializzato!");
    mongoose.disconnect();
  })
  .catch((err) => console.error("Errore:", err));