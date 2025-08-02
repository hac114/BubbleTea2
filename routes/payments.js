const express = require("express");
const router = express.Router();
const Ordine = require("../models/Ordine");
const { StatoOrdine, MetodoPagamento } = require("../enums");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const Statistica = require("../models/Statistica");

// Crea intento di pagamento
router.post("/:id/payment", async (req, res) => {
  try {
    const ordine = await Ordine.findById(req.params.id)
      .populate("tavolo")
      .populate("items");

    if (!ordine) {
      return res.status(404).json({ error: "Ordine non trovato" });
    }

    // Verifica stato ordine
    if (ordine.stato !== StatoOrdine.IN_ATTESA) {
      return res.status(400).json({
        error: `Ordine non pagabile. Stato attuale: ${ordine.stato}`,
      });
    }

    // Calcola totale aggiornato
    await ordine.calcolaTotale();

    // Crea pagamento Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(ordine.totale * 100),
      currency: "eur",
      metadata: {
        orderId: ordine._id.toString(),
        tableNumber: ordine.tavolo.numeroTavolo,
      },
      payment_method_types: ["card", "apple_pay", "google_pay"],
    });

    // Aggiorna ordine
    ordine.stato = StatoOrdine.PAGAMENTO_PENDENTE;
    ordine.stripePaymentId = paymentIntent.id;
    await ordine.save();

    // Registra evento statistico
    await Statistica.registraEvento({
      tipo: "PAGAMENTO_INIZIATO",
      idOrdine: ordine._id,
      importo: ordine.totale,
      metodo: MetodoPagamento.CARTA, // Default, può essere sovrascritto
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      orderStatus: ordine.stato,
    });
  } catch (err) {
    console.error("Errore pagamento:", err);
    res.status(500).json({ error: err.message });
  }
});