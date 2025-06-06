require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const RSSParser = require('rss-parser');
const parser = new RSSParser();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const channelId = process.env.DISCORD_CHANNEL_ID;

// 📈 Función para obtener las tendencias de criptomonedas
async function getCryptoTrends() {
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'volume_desc',
        per_page: 5,
        price_change_percentage: '1h',
        page: 1
      }
    });

    return res.data.map(coin =>
      `🪙 ${coin.name} (${coin.symbol.toUpperCase()}): $${coin.current_price} (${coin.price_change_percentage_1h_in_currency?.toFixed(2)}% en 1h)`
    ).join('\n');

  } catch (error) {
    console.error("❌ Error obteniendo criptomonedas:", error);
    return 'Error al obtener datos de criptomonedas';
  }
}

// 🗞️ Función para leer titulares de Cointelegraph
async function getCryptoNews() {
  try {
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    const top5 = feed.items.slice(0, 5); // los 5 primeros titulares

    return top5.map(item => `📰 [${item.title}](${item.link})`).join('\n');

  } catch (error) {
    console.error("❌ Error obteniendo noticias:", error);
    return 'No se pudieron obtener las noticias.';
  }
}


// 🟢 Evento: cuando el bot está listo
client.once('ready', async () => {
  console.log('✅ Bot conectado a Discord');

  // Cron: cada hora en punto
  cron.schedule('0 * * * *', async () => {

    const channel = await client.channels.fetch(channelId);
    
    const priceMsg = await getCryptoTrends();
    const newsMsg = await getCryptoNews();

    const message = `📊 **Tendencias de criptomonedas (última hora):**\n\n${priceMsg}\n\n🗞️ **Noticias recientes:**\n${newsMsg}`;
    
    channel.send(message);
  });
});

// 🔐 Iniciar sesión
client.login(process.env.DISCORD_TOKEN);
