require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const createHttpError = require("http-errors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Importa la funzione connectDB
const connectDB = require("./config/db");

// Routes
const statsRoutes = require("./routes/stats");

// Inizializza app
const app = express();

// ========================================
//  Middleware
// ========================================
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));

// MIDDLEWARE CRUCIALI: ordine corretto
// Configurazione specifica per il webhook Stripe
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }), // Middleware RAW per Stripe
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const eventTime = new Date().toISOString();

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );

      console.log(`✅ [${eventTime}] Evento Stripe ricevuto:`, event.type);

      // Gestione avanzata degli eventi
      switch (event.type) {
        case "payment_intent.succeeded":
          await handlePaymentSuccess(event.data.object);
          break;

        case "payment_intent.payment_failed":
          console.log(
            "❌ Pagamento fallito:",
            event.data.object.last_payment_error?.message || "Nessun dettaglio",
          );
          break;

        case "checkout.session.completed":
          console.log("🛒 Checkout completato - ID:", event.data.object.id);
          break;

        case "charge.succeeded":
          console.log(
            `💳 Carica completata: ${event.data.object.amount} ${event.data.object.currency}`,
          );
          break;

        case "customer.subscription.created":
          console.log("🔄 Nuova sottoscrizione creata");
          break;

        default:
          console.log(`ℹ️ Evento non gestito: ${event.type}`);
      }

      res.status(200).json({
        status: "success",
        event: event.type,
        timestamp: eventTime,
      });
    } catch (err) {
      console.error(
        `❌ [${new Date().toISOString()}] Errore webhook:`,
        err.message,
      );
      res.status(400).json({
        status: "error",
        message: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  },
);

// ========================================
//  Funzioni di supporto
// ========================================
async function handlePaymentSuccess(paymentIntent) {
  console.log(`💰 Pagamento ${paymentIntent.id} ricevuto:`);
  console.log(
    `- Importo: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`,
  );
  console.log(`- Cliente: ${paymentIntent.customer || "guest"}`);
  console.log(
    `- Metodo: ${paymentIntent.payment_method_types?.join(", ") || "sconosciuto"}`,
  );

  // ESEMPIO: Logica business da implementare
  /*
  try {
    await Order.updateOne(
      { paymentIntentId: paymentIntent.id },
      { status: 'completed', paymentStatus: 'succeeded' }
    );
    console.log('📦 Ordine aggiornato nel database');
  } catch (dbError) {
    console.error('⚠️ Errore database:', dbError.message);
  }
  */
}

// ========================================
//  Altri middleware
// ========================================
app.use(express.json({ limit: "10kb" })); // Per tutte le altre routes

// ========================================
//  Connessione Database e avvio server
// ========================================
connectDB()
  .then(() => {
    // Routes
    app.use("/api/stats", statsRoutes);

    // Health check endpoint avanzato
    app.get("/health", (req, res) => {
      res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        service: "BubbleTea Backend",
        version: process.env.npm_package_version || "1.0.0",
      });
    });

    // Gestione Errori
    app.use((req, res, next) => {
      next(createHttpError(404, "Endpoint non trovato"));
    });

    app.use((err, req, res, next) => {
      const status = err.status || 500;
      console.error(
        `⚠️ [${new Date().toISOString()}] Errore ${status}:`,
        err.message,
      );

      res.status(status).json({
        status: "error",
        message: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    });

    // Avvio Server
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Server avviato con successo:`);
      console.log(`   - URL: http://localhost:${PORT}`);
      console.log(`   - Ambiente: ${process.env.NODE_ENV || "development"}`);
      console.log(`   - Timestamp: ${new Date().toISOString()}\n`);

      console.log("🔌 Endpoint disponibili:");
      console.log(`   - Health check:   http://localhost:${PORT}/health`);
      console.log(`   - Statistiche:    http://localhost:${PORT}/api/stats`);
      console.log(
        `   - Webhook Stripe: http://localhost:${PORT}/webhooks/stripe\n`,
      );
    });

    process.on("unhandledRejection", (err) => {
      console.error("\n⚠️ ERRORE NON GESTITO:", err);
      server.close(() => {
        console.log("🛑 Server chiuso a causa di un errore non gestito");
        process.exit(1);
      });
    });
  })
  .catch((err) => {
    console.error("\n❌ IMPOSSIBILE CONNETTERSI AL DATABASE:", err);
    process.exit(1);
  });