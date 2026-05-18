export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { pdf } = req.body;
  if (!pdf) return res.status(400).json({ error: "Falta el PDF" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key no configurada en el servidor" });

  const prompt =
    "Sos un parser de la Planilla de Totales Generales de sueldos argentina. " +
    "Extraé todos los importes y devolvé SOLO un JSON sin markdown:\n" +
    '{"conceptos":{"CODIGO":numero,...},"totalHabRemun":numero,"totalHabNoRemun":numero,' +
    '"totalRetenciones":numero,"totalContribPatr":numero,"totalAPagar":numero}\n' +
    'CODIGOS son strings ("1010","2010","4010","5010","G993","6982"). ' +
    "Números en formato JS (punto decimal, sin miles). " +
    'Totales de la línea "Totales:" en orden Cant/HabRemun/HabNoRemun/Retenciones/ContribPatr. ' +
    'totalAPagar de "Totales a Pagar:". SOLO JSON.';

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
            { type: "text", text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || "Error API" });
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
    return res.status(200).json(JSON.parse(text));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
