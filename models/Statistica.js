const mongoose = require("mongoose");
const TipoStatistica = require("../enums/TipoStatistica");
const IntervalloTemporale = require("../enums/IntervalloTemporale");
// eslint-disable-next-line no-unused-vars
const { StatoOrdine, StatoPagamento } = require("../enums");

const MetricheSchema = new mongoose.Schema(
  {
    ordiniInAttesa: {
      type: Number,
      default: 0,
      min: 0,
    },
    ordiniCompletati: {
      type: Number,
      default: 0,
      min: 0,
    },
    tempoMedioAttesa: {
      type: Number, // in minuti
      min: 0,
    },
    ordiniPerFasciaOraria: {
      type: Map,
      of: Number,
      default: () =>
        new Map([
          ["08-12", 0],
          ["12-16", 0],
          ["16-20", 0],
          ["20-24", 0],
        ]),
    },
    ingredientiTop: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    rapportoBasi: {
      tea: { type: Number, default: 0 },
      teaLatte: { type: Number, default: 0 },
      custom: { type: Number, default: 0 }, // Aggiunto per completezza
    },
    tempiMediPerStato: {
      // Aggiunto per tracking più dettagliato
      inAttesa: { type: Number }, // minuti
      inPreparazione: { type: Number },
      completato: { type: Number },
    },
    // NUOVI CAMPI AGGIUNTI (compatibili con l'esistente)
    pagamenti: {
      completati: { type: Number, default: 0 },
      falliti: { type: Number, default: 0 },
      rimborsati: { type: Number, default: 0 },
      metodi: {
        carta: { type: Number, default: 0 },
        applePay: { type: Number, default: 0 },
        googlePay: { type: Number, default: 0 },
      },
    },
    tempiPagamento: {
      medioConferma: { type: Number }, // in secondi
      medioFallimento: { type: Number },
    },
  },
  { _id: false },
);

const StatisticaSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: Object.values(TipoStatistica), // Utilizzo dell'enum
      required: true,
      index: true, // Aggiunto indice per query più efficienti
    },
    metriche: {
      type: MetricheSchema,
      required: true,
      validate: {
        validator: function (v) {
          // Validazione custom per coerenza tra tipo e metriche
          if (
            this.tipo === TipoStatistica.INGREDIENTI_POPOLARI &&
            !v.ingredientiTop
          ) {
            return false;
          }
          return true;
        },
        message: (props) => `Metriche non valide per il tipo ${props.tipo}`,
      },
    },
    intervallo: {
      type: String,
      enum: Object.values(IntervalloTemporale), // Utilizzo dell'enum
      required: true,
      index: true,
    },
    timestampRilevazione: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isStorico: {
      type: Boolean,
      default: false,
      index: true,
    },
    sedeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sede",
      index: true,
    },
    // Aggiunti campi per tracciamento
    ultimoAggiornamento: {
      type: Date,
      default: Date.now,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    collection: "statistiche",
    timestamps: false, // Disabilitati se già usi timestampRilevazione
  },
);

// Middleware pre-save per validazioni aggiuntive
StatisticaSchema.pre("save", function (next) {
  if (this.isModified("tipo") && this.isStorico) {
    next(new Error("Non puoi modificare il tipo di statistiche storiche"));
  } else {
    next();
  }
});

// Metodo statico per trovare le statistiche per tipo
StatisticaSchema.statics.findByType = function (tipo) {
  return this.find({ tipo }).lean();
};

// Metodo d'istanza per aggiornare le metriche
StatisticaSchema.methods.aggiornaMetriche = async function (nuoviDati) {
  this.metriche = { ...this.metriche, ...nuoviDati };
  this.ultimoAggiornamento = Date.now();
  return this.save();
};

// ***************************************
// ** NUOVI METODI PER STRIPE (aggiunti) **
// ***************************************

/**
 * Registra un evento di pagamento senza alterare le statistiche esistenti
 */
StatisticaSchema.statics.registraEventoPagamento = async function (evento) {
  const { tipoEvento, idOrdine, importo, metodo } = evento;

  // Trova o crea la statistica del giorno corrente
  const oggi = new Date().setHours(0, 0, 0, 0);
  let stat = await this.findOne({
    tipo: TipoStatistica.STATO_ORDINI,
    intervallo: IntervalloTemporale.OGGI,
    timestampRilevazione: { $gte: new Date(oggi) },
  });

  if (!stat) {
    stat = new this({
      tipo: TipoStatistica.STATO_ORDINI,
      intervallo: IntervalloTemporale.OGGI,
      metriche: {}, // Le metriche saranno popolate dopo
    });
  }

  // Aggiorna i contatori
  switch (tipoEvento) {
    case "PAGAMENTO_COMPLETATO":
      stat.metriche.pagamenti = stat.metriche.pagamenti || {};
      stat.metriche.pagamenti.completati =
        (stat.metriche.pagamenti.completati || 0) + 1;

      if (metodo === "apple_pay") stat.metriche.pagamenti.metodi.applePay += 1;
      else if (metodo === "google_pay")
        stat.metriche.pagamenti.metodi.googlePay += 1;
      else stat.metriche.pagamenti.metodi.carta += 1;
      break;

    case "PAGAMENTO_FALLITO":
      stat.metriche.pagamenti.falliti =
        (stat.metriche.pagamenti.falliti || 0) + 1;
      break;

    case "RIMBORSO":
      stat.metriche.pagamenti.rimborsati =
        (stat.metriche.pagamenti.rimborsati || 0) + 1;
      break;
  }

  await stat.save();
  return stat;
};

/**
 * Aggiorna i tempi medi di pagamento
 */
StatisticaSchema.statics.aggiornaTempiPagamento = async function (
  tempoMs,
  isSuccesso,
) {
  const stat = await this.findOne({
    tipo: TipoStatistica.STATO_ORDINI,
    intervallo: IntervalloTemporale.OGGI,
  });

  if (stat) {
    const campo = isSuccesso ? "medioConferma" : "medioFallimento";
    const tempoSec = Math.round(tempoMs / 1000);

    stat.metriche.tempiPagamento = stat.metriche.tempiPagamento || {};
    stat.metriche.tempiPagamento[campo] = stat.metriche.tempiPagamento[campo]
      ? (stat.metriche.tempiPagamento[campo] + tempoSec) / 2
      : tempoSec;

    await stat.save();
  }
};

// ***************************************
// ** METODI PER UML (nuovi) **
// ***************************************

/**
 * Implementazione del metodo getRicettaOrdine dall'UML
 */
StatisticaSchema.statics.getRicettaOrdine = async function (ordineId) {
  const ordine = await mongoose
    .model("Ordine")
    .findById(ordineId)
    .populate("items.bevanda")
    .populate("items.bevanda.personalizzazione");

  if (!ordine || !ordine.items.length) return null;

  return ordine.items.map((item) => {
    return {
      nome: item.bevanda.nome,
      ingredienti: item.bevanda.personalizzazione
        ? extractIngredienti(item.bevanda.personalizzazione)
        : [],
    };
  });
};

// Helper per estrarre ingredienti
function extractIngredienti(personalizzazione) {
  const ingredienti = [];

  if (personalizzazione.teaBases?.length) {
    ingredienti.push(
      ...personalizzazione.teaBases.map((t) => `Base: ${t.nome}`),
    );
  }
  if (personalizzazione.bubbles?.length) {
    ingredienti.push(
      ...personalizzazione.bubbles.map((b) => `Bubble: ${b.nome}`),
    );
  }
  if (personalizzazione.aromi?.length) {
    ingredienti.push(...personalizzazione.aromi.map((a) => `Aroma: ${a.nome}`));
  }

  return ingredienti;
}

module.exports = mongoose.model("Statistica", StatisticaSchema, "statistiche");