// modules/breakouts.js
const axios = require('axios');

// 🔔 Detectar ruptura de rango en BTC (20h previas)
async function checkBreakouts(channel) {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 20
      }
    });

    const highs = res.data.map(k => parseFloat(k[2]));
    const lows = res.data.map(k => parseFloat(k[3]));
    const lastClose = parseFloat(res.data[res.data.length - 1][4]);

    const recentHigh = Math.max(...highs.slice(0, -1));
    const recentLow = Math.min(...lows.slice(0, -1));

    let msg = '';
    if (lastClose > recentHigh) {
      msg = `🚨 **Breakout alcista detectado en BTC**
Último cierre: $${lastClose} ha superado el rango de $${recentHigh}`;
    } else if (lastClose < recentLow) {
      msg = `⚠️ **Breakout bajista detectado en BTC**
Último cierre: $${lastClose} ha roto por debajo de $${recentLow}`;
    } else {
      msg = `🔄 BTC sigue dentro del rango $${recentLow} - $${recentHigh}`;
    }

    await channel.send(msg);
  } catch (err) {
    console.error('❌ Error en breakout:', err);
  }
}

module.exports = { checkBreakouts };
