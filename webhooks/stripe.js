const router = require("express").Router();
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Ordine = require("../models/Ordine");
const Statistica = require("../models/Statistica");
const { StatoOrdine, StatoPagamento } = require("../enums");

// Middleware cruciale per webhook Stripe
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }), // <-- Middleware ESSENZIALE
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body, // Body raw non parsato
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Log dell'evento per debug
    console.log(`🔔 Received event type: ${event.type}`);

    try {
      // Gestione eventi
      switch (event.type) {
        case "payment_intent.succeeded":
          await handlePaymentSuccess(event.data.object);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentFailure(event.data.object);
          break;
        case "charge.refunded":
          await handleRefund(event.data.object);
          break;
        default:
          console.log(`🤖 Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("❌ Webhook handler error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * Gestisce pagamenti riusciti
 * @param {Object} paymentIntent
 */
async function handlePaymentSuccess(paymentIntent) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ordine = await Ordine.findOneAndUpdate(
      { stripePaymentId: paymentIntent.id },
      {
        $set: {
          stato: StatoOrdine.IN_PREPARAZIONE,
          dataPagamento: new Date(),
          "pagamento.stato": StatoPagamento.COMPLETATO,
        },
      },
      { new: true, session },
    ).populate("items");

    if (!ordine) {
      throw new Error(
        `Ordine non trovato per paymentIntent: ${paymentIntent.id}`,
      );
    }

    // Registra statistiche
    await Statistica.registraEventoPagamento(
      {
        tipoEvento: "PAGAMENTO_COMPLETATO",
        idOrdine: ordine._id,
        importo: paymentIntent.amount / 100,
        metodo: paymentIntent.payment_method_types?.[0] || "card",
        dettagli: {
          tavolo: ordine.tavolo,
          itemsCount: ordine.items.length,
        },
      },
      { session },
    );

    // Aggiorna vendite prodotti
    for (const item of ordine.items) {
      await Statistica.aggiornaVenditeProdotto(item.bevanda, item.quantità, {
        session,
      });
    }

    await session.commitTransaction();
    console.log(`✅ Pagamento ${paymentIntent.id} processato con successo`);
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ Errore transazione:", err);
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Gestisce pagamenti falliti
 * @param {Object} paymentIntent
 */
async function handlePaymentFailure(paymentIntent) {
  await Ordine.findOneAndUpdate(
    { stripePaymentId: paymentIntent.id },
    {
      $set: {
        stato: StatoOrdine.PAGAMENTO_FALLITO,
        "pagamento.stato": StatoPagamento.FALLITO,
      },
    },
  );

  await Statistica.registraEventoPagamento({
    tipoEvento: "PAGAMENTO_FALLITO",
    idOrdine: paymentIntent.metadata.orderId,
    importo: paymentIntent.amount / 100,
    dettagli: {
      motivo: paymentIntent.last_payment_error?.message || "Sconosciuto",
    },
  });

  console.warn(`⚠️ Pagamento fallito: ${paymentIntent.id}`);
}

/**
 * Gestisce rimborsi
 * @param {Object} charge
 */
async function handleRefund(charge) {
  const ordine = await Ordine.findOneAndUpdate(
    { stripePaymentId: charge.payment_intent },
    {
      $set: {
        stato: StatoOrdine.ANNULLATO,
        isDeleted: true,
        motivoAnnullamento: "Rimborsato",
        "pagamento.stato": StatoPagamento.RIMBORSATO,
      },
    },
  );

  if (ordine) {
    await Statistica.registraEventoPagamento({
      tipoEvento: "RIMBORSO",
      idOrdine: ordine._id,
      importo: charge.amount_refunded / 100,
      dettagli: {
        motivo: charge.reason || "Richiesto dal cliente",
      },
    });

    console.log(`↩️ Rimborso processato per ordine: ${ordine._id}`);
  }
}

module.exports = router;