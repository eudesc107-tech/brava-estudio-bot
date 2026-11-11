/**
 * BOT COMENTE E RECEBA NO DIRECT - Instagram
 * Palavras: Aula, Funil, Quente
 *
 * VARIAVEIS DE AMBIENTE (Netlify > Configuracao do site > Variaveis de ambiente):
 * VERIFY_TOKEN = senha de verificacao do webhook
 * ACCESS_TOKEN = token gerado no app da Meta
 * IG_USER_ID = ID numerico da conta do Instagram
 * TRIGGER_WORDS = Aula,Funil,Quente
 *
 * Para ativar: .../.netlify/functions/webhook?action=setup
 * Para conferir: .../.netlify/functions/webhook?action=status
 */

// ===== MENSAGEM DA DM =====
const MENSAGEM_DM =
  "Oi, vi que você comentou no meu post, aqui está o Acesso da Aula Gratuita! " +
  "https://funildeaquecimento.netlify.app/";

// Resposta publica no proprio comentario (deixe "" para desativar)
const RESPOSTA_PUBLICA = "Oi, te enviei o link na sua DM, confere lá!";

const GRAPH = "https://graph.instagram.com/v23.0";

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function json(statusCode, dados) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados, null, 2),
  };
}

exports.handler = async (event) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
  const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";
  const IG_USER_ID = process.env.IG_USER_ID || "";
  const TRIGGER_WORDS = process.env.TRIGGER_WORDS || "Aula,Funil,Quente";

  const params = event.queryStringParameters || {};
  const palavras = TRIGGER_WORDS.split(",")
    .map((p) => normalizar(p))
    .filter(Boolean);

  // ----- ROTA DE ATIVACAO: acesse ?action=setup uma unica vez -----
  if (event.httpMethod === "GET" && params.action === "setup") {
    const res = await fetch(
      `${GRAPH}/${IG_USER_ID}/subscribed_apps?subscribed_fields=comments,messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      }
    );
    const dados = await res.json();
    return json(200, dados);
  }

  // ----- ROTA DE DIAGNOSTICO: acesse ?action=status para conferir -----
  if (event.httpMethod === "GET" && params.action === "status") {
    const res = await fetch(`${GRAPH}/${IG_USER_ID}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const dados = await res.json();
    return json(200, dados);
  }

  // ----- 1. VERIFICACAO DO WEBHOOK (a Meta faz isso uma vez) -----
  if (event.httpMethod === "GET") {
    const modo = params["hub.mode"];
    const token = params["hub.verify_token"];
    const desafio = params["hub.challenge"];

    if (modo === "subscribe" && token === VERIFY_TOKEN) {
      return { statusCode: 200, body: desafio };
    }
    return { statusCode: 403, body: "Token invalido" };
  }

  // ----- 2. RECEBIMENTO DOS COMENTARIOS -----
  if (event.httpMethod === "POST") {
    let corpo;
    try {
      corpo = JSON.parse(event.body || "{}");
    } catch (e) {
      return { statusCode: 200, body: "ok" };
    }

    const entradas = corpo.entry || [];

    for (const entrada of entradas) {
      const mudancas = entrada.changes || [];

      for (const mudanca of mudancas) {
        if (mudanca.field !== "comments") continue;

        const valor = mudanca.value || {};
        const comentarioId = valor.id;
        const texto = normalizar(valor.text);
        const autorId = valor.from && valor.from.id;

        // Ignora comentarios da propria conta (evita loop)
        if (!comentarioId || !texto) continue;
        if (autorId && String(autorId) === String(IG_USER_ID)) continue;

        // Confere se o comentario tem alguma palavra de ativacao
        const ativou = palavras.some((p) => texto.includes(p));
        if (!ativou) continue;

        // Envia a DM (resposta privada ao comentario)
        try {
          const resDm = await fetch(`${GRAPH}/${IG_USER_ID}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              recipient: { comment_id: comentarioId },
              message: { text: MENSAGEM_DM },
            }),
          });
          const dadosDm = await resDm.json();
          console.log("DM:", JSON.stringify(dadosDm));
        } catch (erro) {
          console.error("Erro ao enviar DM:", erro);
        }

        // Responde publicamente o comentario
        if (RESPOSTA_PUBLICA) {
          try {
            const resPub = await fetch(`${GRAPH}/${comentarioId}/replies`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${ACCESS_TOKEN}`,
              },
              body: JSON.stringify({ message: RESPOSTA_PUBLICA }),
            });
            const dadosPub = await resPub.json();
            console.log("Resposta publica:", JSON.stringify(dadosPub));
          } catch (erro) {
            console.error("Erro ao responder comentario:", erro);
          }
        }
      }
    }

    return { statusCode: 200, body: "ok" };
  }

  return { statusCode: 405, body: "Metodo nao permitido" };
};
