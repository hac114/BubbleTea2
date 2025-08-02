const mongoose = require("mongoose");
const OrderItem = require("../../models/OrderItem");
const Bevanda = require("../../models/Bevanda");
const Ordine = require("../../models/Ordine");

// Configurazione con timeout
const DB_URI = "mongodb://localhost:27017/BubbleTea_2";
const DB_TIMEOUT = 5000; // 5 secondi

console.log("[1/6] Connessione al DB in corso...");

mongoose
  .connect(DB_URI, {
    serverSelectionTimeoutMS: DB_TIMEOUT,
  })
  .then(async () => {
    console.log("[2/6] Connesso al DB. Ricerca ordine e bevanda...");

    // Cerca o crea una bevanda se non esiste
    const bevanda =
      (await Bevanda.findOne()) ||
      (await Bevanda.create({
        nome: "Bevanda Default",
        prezzoBase: 4.5,
        custom: false,
        __v: 0,
      }));

    // Verifica obbligatoria dell'ordine
    const ordine = await Ordine.findOne();
    if (!ordine) {
      throw new Error("Nessun ordine trovato nel database");
    }

    console.log("[3/6] Dati trovati:", {
      ordine: ordine._id,
      bevanda: bevanda._id,
    });

    // Configurazione degli OrderItem
    const orderItems = [
      {
        ordine: ordine._id,
        bevanda: bevanda._id,
        quantità: 2,
        prezzoUnitario: bevanda.prezzoBase, // Usa il prezzo dalla bevanda
        dimensione: "L",
        note: "Senza ghiaccio",
        metadata: {
          ingredienti: "tè_verde,tapioca",
          createdAt: new Date().toISOString(),
        },
      },
      {
        ordine: ordine._id,
        bevanda: bevanda._id,
        quantità: 1,
        prezzoUnitario: bevanda.prezzoBase,
        dimensione: "M",
        note: "Con ghiaccio",
        metadata: {
          ingredienti: "tè_nero,boba_frutta",
          createdAt: new Date().toISOString(),
        },
      },
    ];

    console.log("[4/6] Inserimento OrderItem in corso...");
    const result = await OrderItem.insertMany(orderItems);

    // Aggiorna il totale dell'ordine
    const nuovoTotale = orderItems.reduce(
      (tot, item) => tot + item.prezzoUnitario * item.quantità,
      0,
    );

    await Ordine.updateOne(
      { _id: ordine._id },
      { $set: { totale: nuovoTotale } },
    );

    console.log("[5/6] OrderItems creati con successo:", {
      count: result.length,
      orderId: ordine._id,
      nuovoTotale: nuovoTotale.toFixed(2) + "€",
    });
  })
  .catch((err) => {
    console.error("[6/6] ERRORE CRITICO:", {
      message: err.message,
      stack: err.stack.split("\n")[0], // Mostra solo la prima riga dello stack
      action: "Verificare i log precedenti",
    });
  })
  .finally(() => {
    mongoose.disconnect().then(() => {
      console.log("[6/6] Connessione al DB chiusa");
    });
  });