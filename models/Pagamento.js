const mongoose = require("mongoose");
const { Schema } = mongoose;

const pagamentoSchema = new Schema(
  {
    ordine: {
      type: Schema.Types.ObjectId,
      ref: "Ordine",
      required: true,
    },
    stato: {
      type: String,
      enum: ["PENDING", "COMPLETATO", "FALLITO", "RIMBORSATO"],
      default: "PENDING",
    },
    metodo: {
      type: String,
      enum: ["CARTA", "APPLE_PAY", "GOOGLE_PAY"],
      required: true,
    },
    importo: {
      type: Number,
      required: true,
      min: 0,
    },
    stripePaymentId: {
      type: String,
      required: true,
    },
    data: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Pagamento", pagamentoSchema, "pagamenti");