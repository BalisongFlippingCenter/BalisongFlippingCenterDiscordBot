const DISCORD_MESSAGE_LIMIT = 2000;
const EDIT_INTERVAL_MS = 1200;
const NO_PINGS = { parse: [] };

function splitForDiscord(text) {
  const chunks = [];
  let rest = text;
  while (rest.length > DISCORD_MESSAGE_LIMIT) {
    const newline = rest.lastIndexOf('\n', DISCORD_MESSAGE_LIMIT);
    const cut = newline > 0 ? newline : DISCORD_MESSAGE_LIMIT;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  chunks.push(rest);
  return chunks;
}

async function requestLatch(sessionId, message) {
  return fetch(`${process.env.BFC_API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': 'discord',
      'X-Client-Key': process.env.AI_CLIENT_KEY_DISCORD
    },
    body: JSON.stringify({ sessionId, message, currentPath: null })
  });
}

module.exports = async ({ sessionId, question, firstMessage, sendFollowUp }) => {
  const sent = [firstMessage];
  const shown = [''];
  let text = '';

  const render = async () => {
    const chunks = splitForDiscord(text || '…');
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i] === shown[i]) continue;
      if (sent[i]) {
        await sent[i].edit({ content: chunks[i], allowedMentions: NO_PINGS });
      } else {
        sent[i] = await sendFollowUp({ content: chunks[i], allowedMentions: NO_PINGS });
      }
      shown[i] = chunks[i];
    }
  };

  try {
    const response = await requestLatch(sessionId, question);
    if (!response.ok) {
      console.error(`Latch request failed with ${response.status}:`, await response.text());
      text = response.status === 429
        ? "⏳ You're asking Latch questions too quickly — wait a minute and try again."
        : "⚠️ Latch couldn't answer right now. Try again in a moment.";
      return await render();
    }

    const decoder = new TextDecoder();
    let lastRender = 0;
    for await (const chunk of response.body) {
      text += decoder.decode(chunk, { stream: true });
      if (Date.now() - lastRender >= EDIT_INTERVAL_MS) {
        lastRender = Date.now();
        await render();
      }
    }
    text += decoder.decode();
    if (!text.trim()) text = "⚠️ Latch didn't return an answer. Try asking again.";
  } catch (error) {
    console.error('Latch request failed:', error);
    text += `${text ? '\n\n' : ''}⚠️ Lost the connection to Latch. Try asking again.`;
  }

  await render();
};
