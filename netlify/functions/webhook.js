const GRAPH = "https://graph.facebook.com/v21.0";

const PALAVRA = "site";
const LINK =
  "https://wa.me/5583981161874?text=Ol%C3%A1%2C%20quero%20aproveitar%20a%20Oferta%20de%20inaugura%C3%A7%C3%A3o%20da%20Brava%20ag%C3%AAncia%21";
const MENSAGEM_DIRECT =
  "Oi vi que você comentou no meu post! Aqui está o link com a oferta de inauguração";
const RESPOSTA_PUBLICA = "Oi, te enviei o link na sua DM, confere lá!";

async function chamar(url, payload) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const texto = await r.text();
  console.log(url.split("?")[0], r.status, texto);
  return r.ok;
}

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
    const token = encodeURIComponent(ACCESS_TOKEN);

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
        const payloadDirect = {
          recipient: { comment_id: c.id },
          message: { text: `${MENSAGEM_DIRECT}\n\n${LINK}` },
        };

        let enviado = await chamar(
          `${GRAPH}/${IG_USER_ID}/messages?access_token=${token}`,
          payloadDirect
        );

        // Plano B caso o primeiro caminho seja recusado
        if (!enviado) {
          await chamar(`${GRAPH}/me/messages?access_token=${token}`, payloadDirect);
        }

        // Resposta pública no comentário
        await chamar(`${GRAPH}/${c.id}/replies?access_token=${token}`, {
          message: RESPOSTA_PUBLICA,
        });
      }
    }
  } catch (e) {
    console.error("Erro no webhook:", e);
  }

  return { statusCode: 200, body: "ok" };
};
