// modules/support.js
const axios = require('axios');

// 📈 Cálculo simple de soporte/resistencia usando último OHLCV
async function sendSupportResistance(channel) {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 20
      }
    });

    const closes = res.data.map(k => parseFloat(k[4]));
    const lastPrice = closes[closes.length - 1];
    const support = Math.min(...closes).toFixed(2);
    const resistance = Math.max(...closes).toFixed(2);

    const msg = `🔺 **BTC Soporte/Resistencia (últ. 20h)**
Precio actual: $${lastPrice.toFixed(2)}
Soporte: $${support}
Resistencia: $${resistance}`;

    await channel.send(msg);
  } catch (err) {
    console.error('❌ Error soporte/resistencia:', err);
  }
}

module.exports = { sendSupportResistance };
