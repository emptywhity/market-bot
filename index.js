const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser();

// Variables de entorno (definidas en GitHub Secrets)
const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

// Inicializar el cliente de Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 📈 Obtener tendencias de criptomonedas desde CoinPaprika
async function getCryptoTrends() {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/tickers');

    const top5 = res.data
      .filter(coin => coin.rank <= 5)
      .map(coin =>
        `🪙 ${coin.name} (${coin.symbol}): $${coin.quotes.USD.price.toFixed(2)} (${coin.quotes.USD.percent_change_1h?.toFixed(2)}% en 1h)`
      );

    return top5.join('\n');
  } catch (error) {
    console.error("❌ Error obteniendo criptomonedas:", error.response?.data || error.message);
    return 'Error al obtener datos de criptomonedas';
  }
}

// 🗞️ Obtener noticias desde Cointelegraph RSS
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

// 🔁 Ejecutar cuando el bot esté listo
client.once('ready', async () => {
  try {
    const channel = await client.channels.fetch(channelId);
    const priceMsg = await getCryptoTrends();
    const newsMsg = await getCryptoNews();

    const message = `📊 **Tendencias de criptomonedas (última hora):**\n\n${priceMsg}\n\n🗞️ **Noticias recientes:**\n${newsMsg}`;
    await channel.send(message);
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err);
  } finally {
    client.destroy(); // Cierra la conexión y termina el proceso
  }
});

// Iniciar sesión en Discord
client.login(token);
