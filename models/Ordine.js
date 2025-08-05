const mongoose = require("mongoose");
const { Schema } = mongoose;
const Pagamento = require("./Pagamento");
const StatoOrdine = require("../enums/StatoOrdine");
const StatoPagamento = require("../enums/StatoPagamento");
const MetodoPagamento = require("../enums/MetodoPagamento");

// Funzione di validazione per il limite degli items
function validateItemsLimit(items) {
  return items.length <= 20;
}

const ordineSchema = new Schema(
  {
    dataCreazione: { type: Date, default: Date.now },
    stato: {
      type: String,
      enum: Object.values(StatoOrdine),
      default: StatoOrdine.IN_ATTESA,
    },
    tavolo: { type: Schema.Types.ObjectId, ref: "Tavolo", required: true },
    items: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "OrderItem",
        },
      ],
      validate: {
        validator: validateItemsLimit,
        message: "Un ordine non può contenere più di 20 items",
      },
    },
    totale: { type: Number, required: true, min: 0 },
    isDeleted: { type: Boolean, default: false },
    motivoAnnullamento: String,
    pagamento: { type: Schema.Types.ObjectId, ref: "Pagamento" },
    stripePaymentId: String,
    stripeClientSecret: String,
    dataPagamento: Date,
    dataCompletamento: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// 1. Metodo per creare pagamento Stripe
ordineSchema.methods.creaPagamentoStripe = async function (
  metodo = MetodoPagamento.CARTA,
) {
  const stripe = require("stripe")(process.env.STRIPE_KEY);

  if (this.items.length === 0) {
    throw new Error("Impossibile creare pagamento: ordine vuoto");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(this.totale * 100),
    currency: "eur",
    metadata: { ordineId: this._id.toString() },
    payment_method_types: ["card", "apple_pay", "google_pay"],
  });

  const pagamento = await Pagamento.create({
    ordine: this._id,
    metodo,
    importo: this.totale,
    transactionId: paymentIntent.id,
    stato: StatoPagamento.PENDING,
  });

  this.pagamento = pagamento._id;
  this.stripePaymentId = paymentIntent.id;
  this.stripeClientSecret = paymentIntent.client_secret;
  this.stato = StatoOrdine.PAGAMENTO_PENDENTE;
  await this.save();

  return {
    clientSecret: paymentIntent.client_secret,
    paymentId: paymentIntent.id,
  };
};

// 2. Metodo per aggiornare lo stato del pagamento
ordineSchema.methods.aggiornaStatoPagamento = async function (nuovoStato) {
  await this.populate("pagamento");

  if (!this.pagamento) {
    throw new Error("Nessun pagamento associato a questo ordine");
  }

  const mappaStati = {
    [StatoOrdine.COMPLETATO]: StatoPagamento.COMPLETATO,
    [StatoOrdine.PAGAMENTO_FALLITO]: StatoPagamento.FALLITO,
    [StatoOrdine.RITIRATO]: StatoPagamento.COMPLETATO,
    RIMBORSATO: StatoPagamento.RIMBORSATO,
  };

  this.pagamento.stato = mappaStati[nuovoStato] || nuovoStato;
  await this.pagamento.save();

  if (
    [StatoOrdine.COMPLETATO, StatoOrdine.PAGAMENTO_FALLITO].includes(nuovoStato)
  ) {
    this.stato = nuovoStato;
    if (nuovoStato === StatoOrdine.COMPLETATO) {
      this.dataCompletamento = new Date();
    }
    await this.save();
  }

  return this;
};

// 3. Metodo per gestire i rimborsi
ordineSchema.methods.processaRimborso = async function (motivo) {
  const stripe = require("stripe")(process.env.STRIPE_KEY);

  await this.populate("pagamento");
  if (!this.pagamento) {
    throw new Error("Impossibile processare rimborso: pagamento non trovato");
  }

  const refund = await stripe.refunds.create({
    payment_intent: this.pagamento.transactionId,
    reason: motivo || "requested_by_customer",
  });

  await this.aggiornaStatoPagamento("RIMBORSATO");
  this.isDeleted = true;
  this.motivoAnnullamento = motivo || "Rimborsato";
  await this.save();

  return refund;
};

// 4. Metodo per calcolare il totale in tempo reale
ordineSchema.methods.calcolaTotale = async function () {
  await this.populate({
    path: "items",
    populate: [
      { 
        path: "bevanda",
        model: "Bevanda"
      },
      { 
        path: "personalizzazione",
        model: "Personalizzazione",
        populate: [
          { path: "teaBases", model: "Ingrediente" },
          { path: "bubbles", model: "Ingrediente" },
          { path: "aromi", model: "Ingrediente" }
        ]
      }
    ]
  });

  this.totale = this.items.reduce((tot, item) => {
    const prezzoBase = item.bevanda?.prezzoBase || 0;
    const extraPersonalizzazione = item.personalizzazione?.prezzoTotale || 0;
    return tot + (prezzoBase + extraPersonalizzazione) * item.quantità;
  }, 0);

  await this.save();
  return this.totale;
};

// Helper per calcolare extra personalizzazione
function calculatePersonalizationExtra(personalizzazione) {
  let extra = 0;
  // Calcola extra per ingredienti aggiuntivi
  if (personalizzazione.teaBases?.length > 1) {
    extra += (personalizzazione.teaBases.length - 1) * 0.5;
  }
  if (personalizzazione.bubbles?.length > 0) {
    extra += personalizzazione.bubbles.length * 0.3;
  }
  if (personalizzazione.aromi?.length > 0) {
    extra += personalizzazione.aromi.length * 0.4;
  }
  return extra;
}

// 5. Metodo per verificare lo stato pagamento
ordineSchema.methods.verificaStatoPagamento = async function () {
  if (!this.stripePaymentId) return null;

  const stripe = require("stripe")(process.env.STRIPE_KEY);
  const paymentIntent = await stripe.paymentIntents.retrieve(
    this.stripePaymentId,
  );

  let nuovoStato;
  switch (paymentIntent.status) {
    case "succeeded":
      nuovoStato = StatoOrdine.COMPLETATO;
      this.dataPagamento = new Date();
      break;
    case "canceled":
      nuovoStato = StatoOrdine.ANNULLATO;
      break;
    case "requires_payment_method":
      nuovoStato = StatoOrdine.PAGAMENTO_FALLITO;
      break;
    default:
      nuovoStato = StatoOrdine.PAGAMENTO_PENDENTE;
  }

  await this.aggiornaStatoPagamento(nuovoStato);
  return paymentIntent.status;
};

// Virtual properties
ordineSchema.virtual("numeroItems").get(function () {
  return this.items?.length || 0;
});

ordineSchema.virtual("isPagato").get(function () {
  return this.pagamento?.stato === StatoPagamento.COMPLETATO;
});

// Validazione pre-save
ordineSchema.pre("save", function (next) {
  if (this.items && this.items.length > 20) {
    throw new Error(
      "ValidationError: Un ordine non può contenere più di 20 items",
    );
  }

  if (this.stato === StatoOrdine.COMPLETATO && !this.dataCompletamento) {
    this.dataCompletamento = new Date();
  }

  next();
});

module.exports = mongoose.model("Ordine", ordineSchema, "ordini");