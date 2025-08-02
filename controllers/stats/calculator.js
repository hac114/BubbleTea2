// backend/controllers/stats/calculator.js
const mongoose = require("mongoose");
const BubbleTeaAnalytics = require("../../models/Statistica");
const Ordine = require("../../models/Ordine");
const path = require("path");
const fs = require("fs");

// DEBUG: Verifica importazioni
console.log("=== INIZIO DEBUG IMPORTAZIONI ===");

// 1. Verifica importazione modello Ingrediente
let IngredienteModel;
try {
  const ingredienteModule = require("../../models/Ingrediente");
  IngredienteModel = ingredienteModule.Ingrediente || ingredienteModule;
  console.log(
    "Modello Ingrediente importato correttamente:",
    IngredienteModel ? "Successo" : "Fallito",
  );
  if (IngredienteModel) {
    console.log("Tipo modello:", typeof IngredienteModel);
    console.log("Metodi disponibili:", Object.keys(IngredienteModel));
  }
} catch (err) {
  console.error("Errore importazione modello Ingrediente:", err);
  throw new Error("Importazione fallita del modello Ingrediente");
}

// 2. Verifica enum
const enumDir = path.join(__dirname, "../../enums");
try {
  console.log("Contenuto cartella enums:", fs.readdirSync(enumDir));
} catch (err) {
  console.error("Errore lettura cartella enums:", err);
}

// Import con gestione errori robusta
let StatoOrdine, TipoStatistica, IntervalloTemporale;

try {
  const statoOrdineImport = require("../../enums/StatoOrdine");
  StatoOrdine = statoOrdineImport.StatoOrdine || statoOrdineImport;
  console.log("StatoOrdine importato correttamente:", StatoOrdine);
} catch (err) {
  console.error("Errore import StatoOrdine:", err);
  StatoOrdine = {
    IN_ATTESA: "In attesa",
    IN_PREPARAZIONE: "In preparazione",
    COMPLETATO: "Completato",
    RITIRATO: "Ritirato",
  };
  console.warn("Usato StatoOrdine fallback:", StatoOrdine);
}

try {
  const tipoStatisticaImport = require("../../enums/TipoStatistica");
  TipoStatistica = tipoStatisticaImport.TipoStatistica || tipoStatisticaImport;
  console.log("TipoStatistica importato correttamente:", TipoStatistica);
} catch (err) {
  console.error("Errore import TipoStatistica:", err);
  TipoStatistica = {
    STATO_ORDINI: "STATO_ORDINI",
    TREND_TEMPORALI: "TREND_TEMPORALI",
    INGREDIENTI_POPOLARI: "INGREDIENTI_POPOLARI",
    RICETTA_ORDINE: "RICETTA_ORDINE",
  };
  console.warn("Usato TipoStatistica fallback:", TipoStatistica);
}

try {
  const intervalloTemporaleImport = require("../../enums/IntervalloTemporale");
  IntervalloTemporale =
    intervalloTemporaleImport.IntervalloTemporale || intervalloTemporaleImport;
  console.log(
    "IntervalloTemporale importato correttamente:",
    IntervalloTemporale,
  );
} catch (err) {
  console.error("Errore import IntervalloTemporale:", err);
  IntervalloTemporale = {
    ULTIMA_ORA: "ULTIMA_ORA",
    OGGI: "OGGI",
    SETTIMANA_CORRENTE: "SETTIMANA_CORRENTE",
    MESE_CORRENTE: "MESE_CORRENTE",
  };
  console.warn("Usato IntervalloTemporale fallback:", IntervalloTemporale);
}

class StatsCalculator {
  /**
   * Calcola le statistiche degli ordini
   * @returns {Promise<{ordiniInAttesa: number, ordiniCompletati: number, tempoMedioAttesa: number}>}
   */
  static async calcolaStatisticheOrdini() {
    try {
      console.log("=== DEBUG STATOORDINE ===");
      console.log("Tipo:", typeof StatoOrdine);
      console.log("Keys:", Object.keys(StatoOrdine || {}));
      console.log("Valore IN_ATTESA:", StatoOrdine?.IN_ATTESA);

      if (!StatoOrdine || !StatoOrdine.IN_ATTESA) {
        console.error("STATOORDINE INVALIDO!", {
          isNull: StatoOrdine === null,
          isUndefined: StatoOrdine === undefined,
          keys: Object.keys(StatoOrdine || {}),
        });
        throw new Error("StatoOrdine non è stato importato correttamente");
      }

      const ordini = await Ordine.aggregate([
        {
          $match: {
            stato: {
              $in: [StatoOrdine.IN_ATTESA, StatoOrdine.COMPLETATO],
            },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: "$stato",
            count: { $sum: 1 },
            avgTime: {
              $avg: {
                $divide: [
                  { $subtract: ["$timestampRitiro", "$timestampCreazione"] },
                  60000, // Converti ms in minuti
                ],
              },
            },
          },
        },
      ]);

      const result = {
        ordiniInAttesa:
          ordini.find((o) => o._id === StatoOrdine.IN_ATTESA)?.count || 0,
        ordiniCompletati:
          ordini.find((o) => o._id === StatoOrdine.COMPLETATO)?.count || 0,
        tempoMedioAttesa: Math.round(
          ordini.find((o) => o._id === StatoOrdine.COMPLETATO)?.avgTime || 0,
        ),
      };

      console.log("Risultato calcolo statistiche:", result);
      return result;
    } catch (error) {
      console.error("Errore calcolo statistiche ordini:", {
        message: error.message,
        stack: error.stack,
        StatoOrdineInError: StatoOrdine,
      });
      throw new Error(
        "Errore durante il calcolo delle statistiche: " + error.message,
      );
    }
  }

  /**
   * Calcola gli ingredienti più popolari
   * @returns {Promise<Array<{nome: string, conteggioUtilizzi: number, popolarita: string, tipo: string}>>}
   */
  static async calcolaIngredientiPopolari() {
    try {
      if (!IngredienteModel || typeof IngredienteModel.find !== "function") {
        console.error("Modello Ingrediente non valido - Dettagli:", {
          isDefined: IngredienteModel !== undefined,
          isFunction: typeof IngredienteModel.find,
          model: IngredienteModel,
        });
        throw new Error("Modello Ingrediente non configurato correttamente");
      }

      console.log("Esecuzione query sugli ingredienti...");
      const result = await IngredienteModel.find({ isDeleted: { $ne: true } })
        .sort({ conteggioUtilizzi: -1 })
        .limit(5)
        .select("nome conteggioUtilizzi tipo")
        .lean();

      console.log("Risultato query ingredienti:", result);

      const ingredientiFormattati = result.map((i) => ({
        nome: i.nome,
        conteggioUtilizzi: i.conteggioUtilizzi || 0,
        tipo: i.tipo,
        popolarita: this.calcolaLivelloPopolarita(i.conteggioUtilizzi || 0),
      }));

      console.log("Ingredienti popolari formattati:", ingredientiFormattati);
      return ingredientiFormattati;
    } catch (error) {
      console.error("Errore calcolo ingredienti popolari:", {
        message: error.message,
        stack: error.stack,
        modelStatus: {
          isDefined: IngredienteModel !== undefined,
          hasFind: typeof IngredienteModel.find === "function",
          model: IngredienteModel ? "Definito" : "Non definito",
        },
      });
      throw new Error(
        "Errore durante il calcolo della popolarità ingredienti: " +
          error.message,
      );
    }
  }

  static calcolaLivelloPopolarita(conteggio) {
    if (conteggio >= 100) return "ALTA";
    if (conteggio >= 50) return "MEDIA";
    return "BASSA";
  }

  static async salvaStatistiche(tipo, intervallo, dati) {
    try {
      if (!Object.values(TipoStatistica).includes(tipo)) {
        throw new Error(
          `Tipo statistica non valido: ${tipo}. Valori accettati: ${Object.values(TipoStatistica).join(", ")}`,
        );
      }
      if (!Object.values(IntervalloTemporale).includes(intervallo)) {
        throw new Error(
          `Intervallo non valido: ${intervallo}. Valori accettati: ${Object.values(IntervalloTemporale).join(", ")}`,
        );
      }

      const result = await BubbleTeaAnalytics.findOneAndUpdate(
        { tipo, intervallo },
        {
          $set: {
            metriche: dati,
            ultimoAggiornamento: new Date(),
          },
          $inc: { version: 1 },
        },
        { upsert: true, new: true },
      );

      console.log(`Statistiche salvate: ${tipo}/${intervallo}`, {
        id: result._id,
        version: result.version,
      });
      return result;
    } catch (error) {
      console.error("Errore salvataggio statistiche:", {
        tipo,
        intervallo,
        message: error.message,
        stack: error.stack,
      });
      throw new Error(
        "Errore durante il salvataggio delle statistiche: " + error.message,
      );
    }
  }

  static async generaTutteLeStatistiche() {
    try {
      console.log("Avvio generazione statistiche...");

      const statsOrdini = await this.calcolaStatisticheOrdini();
      await this.salvaStatistiche(
        TipoStatistica.STATO_ORDINI,
        IntervalloTemporale.OGGI,
        statsOrdini,
      );

      const statsIngredienti = await this.calcolaIngredientiPopolari();
      const ingredientiMap = new Map(
        statsIngredienti.map((i) => [
          i.nome,
          {
            conteggio: i.conteggioUtilizzi,
            popolarita: i.popolarita,
            tipo: i.tipo,
          },
        ]),
      );

      await this.salvaStatistiche(
        TipoStatistica.INGREDIENTI_POPOLARI,
        IntervalloTemporale.OGGI,
        { ingredientiTop: Object.fromEntries(ingredientiMap) },
      );

      console.log("Generazione statistiche completata");
      return {
        success: true,
        message: "Statistiche aggiornate correttamente",
        timestamp: new Date(),
        details: {
          ordini: statsOrdini,
          ingredienti: statsIngredienti.length,
        },
      };
    } catch (error) {
      console.error("Errore generazione statistiche:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
      return {
        success: false,
        message: error.message,
        errorDetails: {
          stack: error.stack,
          type: error.constructor.name,
        },
        timestamp: new Date(),
      };
    }
  }
}

module.exports = StatsCalculator;
