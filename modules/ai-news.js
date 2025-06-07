// modules/ai-news.js
const RSSParser = require('rss-parser');
const parser = new RSSParser();

async function sendAINewsSummary(channel) {
  try {
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    const top5 = feed.items.slice(0, 5);
    const formatted = top5.map(item => `📰 [${item.title}](${item.link})`).join('\n');

    await channel.send(`🗞️ **Noticias recientes del mercado cripto:**\n\n${formatted}`);
  } catch (error) {
    console.error("❌ Error al obtener noticias:", error);
    await channel.send("❌ No se pudieron obtener las noticias del mercado.");
  }
}

module.exports = { sendAINewsSummary };
