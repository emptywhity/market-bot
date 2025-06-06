require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const RSSParser = require('rss-parser');
const parser = new RSSParser();

// Discord bot client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const channelId = process.env.DISCORD_CHANNEL_ID;

// 📈 Obtener tendencias de criptomonedas (CoinPaprika)
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

// 🗞️ Obtener noticias recientes de Cointelegraph
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

// 🟢 Cuando el bot esté listo
client.once('ready', async () => {
  console.log('✅ Bot conectado a Discord');

  cron.schedule('0 * * * *', async () => {
    const channel = await client.channels.fetch(channelId);
    const priceMsg = await getCryptoTrends();
    const newsMsg = await getCryptoNews();

    const message = `📊 **Tendencias de criptomonedas (última hora):**\n\n${priceMsg}\n\n🗞️ **Noticias recientes:**\n${newsMsg}`;
    channel.send(message);
  });
});

// 🔐 Iniciar sesión en Discord
client.login(process.env.DISCORD_TOKEN);

// 🌐 Express para mantener vivo el servicio en Render
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot de criptomonedas activo ✅'));
app.listen(PORT, () => console.log(`🌐 Servidor Express escuchando en puerto ${PORT}`));
