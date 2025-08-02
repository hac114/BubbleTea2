const express = require("express");
const StatsCalculator = require("../controllers/stats/calculator");
const router = express.Router();

// Endpoint: /stats/ordini
router.get("/ordini", async (req, res) => {
  try {
    const stats = await StatsCalculator.calcolaStatisticheOrdini();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;