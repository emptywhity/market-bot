// market-features.js
const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser();

// —————————————— 1. Heatmap ——————————————
async function sendHeatmap(channel) {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/tickers');
    const top10 = res.data
      .filter(c => c.rank <= 10)
      .map(c => {
        const pct = c.quotes.USD.percent_change_1h;
        const emoji = pct > 1   ? '🟩'
                    : pct < -1  ? '🟥'
                    :            '🟨';
        return `${emoji} ${c.symbol}: ${pct?.toFixed(2)}%`;
      });
    await channel.send(`🧊 **Mapa de calor (1h):**\n${top10.join(' | ')}`);
  } catch (err) {
    console.error('❌ Error en heatmap:', err);
  }
}

// —————————————— 2. Soporte/Resistencia ——————————————
async function sendSupportResistance(channel) {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol: 'BTCUSDT', interval: '1h', limit: 20 }
    });
    const closes = res.data.map(k => parseFloat(k[4]));
    const lastPrice  = closes.at(-1).toFixed(2);
    const support    = Math.min(...closes).toFixed(2);
    const resistance = Math.max(...closes).toFixed(2);
    await channel.send(
      `🔺 **BTC Soporte/Resistencia (20h):**\n` +
      `Precio: $${lastPrice}\nSoporte: $${support}\nResistencia: $${resistance}`
    );
  } catch (err) {
    console.error('❌ Error soporte/resistencia:', err);
  }
}

// —————————————— 3. Breakouts ——————————————
async function checkBreakouts(channel) {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol: 'BTCUSDT', interval: '1h', limit: 20 }
    });
    const highs = res.data.map(k => parseFloat(k[2]));
    const lows  = res.data.map(k => parseFloat(k[3]));
    const lastClose   = parseFloat(res.data.at(-1)[4]);
    const recentHigh  = Math.max(...highs.slice(0, -1));
    const recentLow   = Math.min(...lows.slice(0, -1));
    let msg;
    if (lastClose > recentHigh) {
      msg = `🚨 **Breakout alcista BTC:** $${lastClose} > ${recentHigh}`;
    } else if (lastClose < recentLow) {
      msg = `⚠️ **Breakout bajista BTC:** $${lastClose} < ${recentLow}`;
    } else {
      msg = `🔄 BTC en rango ${recentLow}–${recentHigh}`;
    }
    await channel.send(msg);
  } catch (err) {
    console.error('❌ Error en breakout:', err);
  }
}

// —————————————— 4. Watchlist ——————————————
const watchlist = [
  { id: 'bitcoin', symbol: 'BTC', threshold: 1.5 },
  { id: 'ethereum', symbol: 'ETH', threshold: 2 },
  { id: 'solana', symbol: 'SOL', threshold: 3 },
];
async function checkWatchlist(channel) {
  try {
    const ids = watchlist.map(c => c.id).join(',');
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets',
      { params: { vs_currency: 'usd', ids, price_change_percentage: '1h' } }
    );
    const alerts = data
      .map(c => {
        const w = watchlist.find(x => x.id === c.id);
        const change = c.price_change_percentage_1h_in_currency;
        if (Math.abs(change) >= w.threshold) {
          const dir = change > 0 ? '🔼 subido' : '🔻 bajado';
          return `🚨 ${w.symbol} ${dir} ${change.toFixed(2)}% (precio $${c.current_price})`;
        }
      })
      .filter(Boolean);
    if (alerts.length) {
      await channel.send(`📈 **Alertas Watchlist:**\n${alerts.join('\n')}`);
    }
  } catch (err) {
    console.error('❌ Error watchlist:', err);
  }
}

// —————————————— 5. Patrones técnicos ——————————————
async function checkPatterns(channel) {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol: 'BTCUSDT', interval: '1h', limit: 10 }
    });
    const closes = res.data.map(k => parseFloat(k[4]));
    const [first, mid, last] = [closes[0], closes.at(-2), closes.at(-1)];
    let msg;
    if (first > mid && last > mid && Math.abs(first - last)/mid < 0.02) {
      msg = '📈 **Doble suelo potencial**';
    } else if (first < mid && last < mid && Math.abs(first - last)/mid < 0.02) {
      msg = '📉 **Doble techo potencial**';
    }
    if (msg) await channel.send(`${msg}\nPrecios: ${closes.map(c => c.toFixed(2)).join(' → ')}`);
  } catch (err) {
    console.error('❌ Error patrones:', err);
  }
}

// —————————————— 6. Resumen diario ——————————————
async function sendDailySummary(channel, tipo) {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/tickers');
    const top5 = res.data.filter(c => c.rank <= 5);
    const lines = top5.map(c => {
      const chg = c.quotes.USD.percent_change_24h.toFixed(2);
      return `• ${c.symbol}: $${c.quotes.USD.price.toFixed(2)} (${chg}%)`;
    }).join('\n');
    const label = tipo === 'pre'
      ? '🌅 **Resumen Pre-Mercado**'
      : '🌙 **Resumen Post-Mercado**';
    await channel.send(`${label}\n${lines}`);
  } catch (err) {
    console.error('❌ Error resumen diario:', err);
  }
}

// —————————————— 7. Noticias ——————————————
async function sendCryptoNews(channel) {
  try {
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    const top5 = feed.items.slice(0, 5);
    const out = top5.map(i => `📰 [${i.title}](${i.link})`).join('\n');
    await channel.send(`🗞️ **Noticias Cripto:**\n${out}`);
  } catch (err) {
    console.error('❌ Error noticias:', err);
  }
}

module.exports = {
  sendHeatmap,
  sendSupportResistance,
  checkBreakouts,
  checkWatchlist,
  checkPatterns,
  sendDailySummary,
  sendCryptoNews
};
