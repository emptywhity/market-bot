const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser();

// Variables de entorno (GitHub Actions)
const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

// Inicializar cliente Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 📈 Tendencias cripto (CoinPaprika)
async function getCryptoTrends() {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/tickers');

    const top5 = res.data
      .filter(coin => coin.rank <= 5)
      .map(coin => {
        const pct = coin.quotes.USD.percent_change_1h;
        const emoji = pct >= 0 ? '📈' : '📉';
        return `${emoji} ${coin.name} (${coin.symbol}): $${coin.quotes.USD.price.toFixed(2)} (${pct?.toFixed(2)}% en 1h)`;
      });

    return top5.join('\n');
  } catch (error) {
    console.error("❌ Error obteniendo criptomonedas:", error.response?.data || error.message);
    return 'Error al obtener datos de criptomonedas';
  }
}

// 🗞️ Noticias cripto (Cointelegraph)
async function getCryptoNews() {
  try {
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    const top5 = feed.items.slice(0, 5);
    return top5.map(item => `📰 [${item.title}](${item.link})`).join('\n');
  } catch (error) {
    console.error("❌ Error obteniendo noticias:", error);
    return 'No se pudieron obtener las noticias.';
  }
}

// 🔁 Al iniciar
client.once('ready', async () => {
  try {
    const channel = await client.channels.fetch(channelId);
    const priceMsg = await getCryptoTrends();
    const newsMsg = await getCryptoNews();
    const now = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

    const message = 
`📊 **Top 5 Criptomonedas por volumen (1h):**\n\n${priceMsg}

━━━━━━━━━━━━━━━━━━

🗞️ **Noticias Cripto Recientes:**\n${newsMsg}

🕒 *Actualizado: ${now}*`;

    await channel.send(message);
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err);
  } finally {
    client.destroy(); // Cierra conexión
  }
});

// Inicia sesión en Discord
client.login(token);
