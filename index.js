require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser();

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 📈 Top ganadoras/perdedoras
async function getWinnersAndLosers() {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/tickers');
    const coins = res.data.filter(c => c.quotes.USD.percent_change_1h != null);

    const winners = [...coins].sort((a, b) => b.quotes.USD.percent_change_1h - a.quotes.USD.percent_change_1h).slice(0, 3);
    const losers = [...coins].sort((a, b) => a.quotes.USD.percent_change_1h - b.quotes.USD.percent_change_1h).slice(0, 3);

    const winMsg = winners.map(c => `📈 ${c.name} (${c.symbol}): +${c.quotes.USD.percent_change_1h.toFixed(2)}%`).join('\n');
    const loseMsg = losers.map(c => `📉 ${c.name} (${c.symbol}): ${c.quotes.USD.percent_change_1h.toFixed(2)}%`).join('\n');

    return `🏆 **Top 3 Ganadoras (1h):**\n${winMsg}\n\n💀 **Top 3 Perdedoras (1h):**\n${loseMsg}`;
  } catch (error) {
    console.error("❌ Error obteniendo datos:", error.response?.data || error.message);
    return 'No se pudieron obtener las ganadoras/perdedoras.';
  }
}

// 🧠 Dominancia BTC
async function getBTCDominance() {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/global');
    return `🧮 **Dominancia BTC:** ${res.data.bitcoin_dominance_percentage.toFixed(2)}%`;
  } catch (error) {
    console.error("❌ Error obteniendo dominancia BTC:", error.message);
    return 'No se pudo obtener la dominancia de BTC.';
  }
}

// 💸 Funding rate BTC y ETH
async function getFundingRates() {
  try {
    const [btc, eth] = await Promise.all([
      axios.get('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT'),
      axios.get('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=ETHUSDT')
    ]);

    return `💸 **Funding Rates:**\n• BTC: ${parseFloat(btc.data.lastFundingRate * 100).toFixed(4)}%\n• ETH: ${parseFloat(eth.data.lastFundingRate * 100).toFixed(4)}%`;
  } catch (error) {
    console.error("❌ Error obteniendo funding rates:", error.message);
    return 'No se pudieron obtener los funding rates.';
  }
}

// 🗞️ Noticias recientes
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

// 🔁 Al iniciar el bot
client.once('ready', async () => {
  try {
    const channel = await client.channels.fetch(channelId);
    const [winnersLosers, dominance, funding, news] = await Promise.all([
      getWinnersAndLosers(),
      getBTCDominance(),
      getFundingRates(),
      getCryptoNews()
    ]);
    const now = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

    const message = 
`📊 **Resumen de Mercado Cripto (1h):**

${winnersLosers}

━━━━━━━━━━━━━━━━━━

${dominance}
${funding}

━━━━━━━━━━━━━━━━━━

🗞️ **Noticias Recientes:**
${news}

🕒 *Actualizado: ${now}*`;

    await channel.send(message);
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err);
  } finally {
    client.destroy();
  }
});

client.login(token);
