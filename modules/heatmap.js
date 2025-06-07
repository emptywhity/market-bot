// modules/heatmap.js
const axios = require('axios');

// 🔥 Mostrar top monedas con emojis de color
async function sendHeatmap(channel) {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/tickers');
    const top10 = res.data
      .filter(c => c.rank <= 10)
      .map(c => {
        const pct = c.quotes.USD.percent_change_1h;
        const emoji = pct > 1 ? '🟩' : pct < -1 ? '🟥' : '🟨';
        return `${emoji} ${c.symbol}: ${pct?.toFixed(2)}%`;
      });

    const msg = `🧊 **Mapa de calor (1h)**
${top10.join(' | ')}`;
    await channel.send(msg);
  } catch (err) {
    console.error('❌ Error en heatmap:', err);
  }
}

module.exports = { sendHeatmap };
