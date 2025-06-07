// modules/patterns.js
const axios = require('axios');

// 📉 Detectar patrones simples como doble suelo o doble techo
async function checkPatterns(channel) {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 10
      }
    });

    const closes = res.data.map(k => parseFloat(k[4]));
    const last = closes[closes.length - 1];
    const mid = closes[Math.floor(closes.length / 2)];
    const first = closes[0];

    let msg = null;
    if (first > mid && last > mid && Math.abs(first - last) / mid < 0.02) {
      msg = '📈 **Doble suelo potencial detectado**';
    } else if (first < mid && last < mid && Math.abs(first - last) / mid < 0.02) {
      msg = '📉 **Doble techo potencial detectado**';
    }

    if (msg) {
      await channel.send(`${msg}\nPrecios: ${closes.map(c => c.toFixed(2)).join(' → ')}`);
    }
  } catch (err) {
    console.error('❌ Error en patrón técnico:', err);
  }
}

module.exports = { checkPatterns };
