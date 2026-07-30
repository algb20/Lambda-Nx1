// Vercel Serverless Function
// POST /api/pi-approve  ->  body: { paymentId }
// Approves a Pi Network payment on the server (Server-Side Approval flow).
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { paymentId } = body;

    if (!paymentId) {
      return res.status(400).json({ error: "Missing paymentId" });
    }

    const r = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.PI_API_KEY}`,
        },
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
