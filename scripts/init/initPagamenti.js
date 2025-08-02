const mongoose = require("mongoose");
const Pagamento = require("../../models/Pagamento");
const Ordine = require("../../models/Ordine");

mongoose
  .connect("mongodb://localhost:27017/BubbleTea_2")
  .then(async () => {
    // Recupera un ordine esistente
    const ordine = await Ordine.findOne();
    if (!ordine) throw new Error("Nessun ordine trovato");

    // Crea un pagamento fittizio (simula Stripe ID)
    const pagamento = await Pagamento.create({
      ordine: ordine._id,
      metodo: "CARTA",
      importo: ordine.totale,
      stripePaymentId: "pi_" + Math.random().toString(36).slice(2),
    });

    // Collega il pagamento all'ordine
    ordine.pagamento = pagamento._id;
    await ordine.save();

    console.log("Pagamento creato e collegato all'ordine:", pagamento);
  })
  .catch((err) => console.error("ERRORE:", err))
  .finally(() => mongoose.disconnect());