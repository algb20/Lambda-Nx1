// Vercel Serverless Function
// POST /api/pi-complete  ->  body: { paymentId, txid }
// Completes a Pi Network payment on the server after the blockchain txid exists.
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { paymentId, txid } = body;

    if (!paymentId || !txid) {
      return res.status(400).json({ error: "Missing paymentId or txid" });
    }

    const r = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.PI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
