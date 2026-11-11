const GRAPH = "https://graph.instagram.com/v21.0";

const PALAVRA = "site";
const LINK =
  "https://wa.me/5583981161874?text=Ol%C3%A1%2C%20quero%20aproveitar%20a%20Oferta%20de%20inaugura%C3%A7%C3%A3o%20da%20Brava%20ag%C3%AAncia%21";
const MENSAGEM_DIRECT =
  "Oi vi que você comentou no meu post! Aqui está o link com a oferta de inauguração";
const RESPOSTA_PUBLICA = "Oi, te enviei o link na sua DM, confere lá!";

exports.handler = async (event) => {
  const { VERIFY_TOKEN, ACCESS_TOKEN, IG_USER_ID } = process.env;

  // Validação do webhook pela Meta
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === VERIFY_TOKEN) {
      return { statusCode: 200, body: q["hub.challenge"] };
    }
    return { statusCode: 403, body: "Token inválido" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método não permitido" };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "comments") continue;

        const c = change.value || {};
        const texto = (c.text || "").toLowerCase();
        const autor = c.from && c.from.id;

        // Ignora comentários da própria conta e comentários sem a palavra
        if (!c.id || autor === IG_USER_ID) continue;
        if (!new RegExp("\\b" + PALAVRA + "\\b").test(texto)) continue;

        // Direct com o link (resposta privada ao comentário)
        await fetch(`${GRAPH}/${IG_USER_ID}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            recipient: { comment_id: c.id },
            message: { text: `${MENSAGEM_DIRECT}\n\n${LINK}` },
          }),
        });

        // Resposta pública no comentário
        await fetch(`${GRAPH}/${c.id}/replies`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ACCESS_TOKEN}`,
          },
          body: JSON.stringify({ message: RESPOSTA_PUBLICA }),
        });
      }
    }
  } catch (e) {
    console.error("Erro no webhook:", e);
  }

  return { statusCode: 200, body: "ok" };
};
