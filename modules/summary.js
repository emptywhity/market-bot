// modules/summary.js
const axios = require('axios');

// 🌄 Enviar resumen pre o post mercado (según tipo)
async function sendDailySummary(channel, tipo) {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/tickers');
    const top = res.data.filter(c => c.rank <= 5);

    const lines = top.map(c => {
      const change = c.quotes.USD.percent_change_24h?.toFixed(2);
      return `• ${c.name} (${c.symbol}): $${c.quotes.USD.price.toFixed(2)} (${change}%)`;
    }).join('\n');

    const label = tipo === 'pre' ? '🌅 **Resumen Pre-Mercado**' : '🌙 **Resumen Post-Mercado**';
    const msg = `${label}\n${lines}`;

    await channel.send(msg);
  } catch (err) {
    console.error('❌ Error en daily summary:', err);
  }
}

module.exports = { sendDailySummary };
