const axios = require('axios');
const RSSParser = require('rss-parser');
const parser = new RSSParser();

// ————————— 1. Watchlist: alerta por variación porcentual —————————
const watchlist = [
  { id: 'bitcoin', symbol: 'BTC', threshold: 1.5 },
  { id: 'ethereum', symbol: 'ETH', threshold: 2 },
  { id: 'solana', symbol: 'SOL', threshold: 3 }
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
          return `🚨 ${w.symbol} ${dir} ${change.toFixed(2)}% (precio $${c.current_price.toFixed(2)})`;
        }
        return null;
      })
      .filter(Boolean);
    if (alerts.length) await channel.send(`📈 **Alertas Watchlist**:
${alerts.join('\n')}`);
  } catch (err) {
    console.error('❌ Error watchlist:', err.message);
  }
}

// ————————— 2. Breakouts de rango —————————
async function checkBreakouts(channel) {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol: 'BTCUSDT', interval: '1h', limit: 20 }
    });
    const highs = res.data.map(k => parseFloat(k[2]));
    const lows  = res.data.map(k => parseFloat(k[3]));
    const lastClose = parseFloat(res.data.at(-1)[4]);
    const recentHigh = Math.max(...highs.slice(0, -1));
    const recentLow  = Math.min(...lows.slice(0, -1));
    let msg;
    if (lastClose > recentHigh) msg = `🚨 **Breakout alcista BTC:** $${lastClose.toFixed(2)} > ${recentHigh.toFixed(2)}`;
    else if (lastClose < recentLow) msg = `⚠️ **Breakout bajista BTC:** $${lastClose.toFixed(2)} < ${recentLow.toFixed(2)}`;
    else return;  // no enviar si sigue en rango
    await channel.send(msg);
  } catch (err) {
    console.error('❌ Error breakout:', err.message);
  }
}

// ————————— 3. Top 3 ganadoras/perdedoras 1h —————————
async function getWinnersLosers(channel) {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/tickers');
    const coins = res.data.filter(c => c.quotes.USD.percent_change_1h != null);
    const winners = [...coins]
      .sort((a, b) => b.quotes.USD.percent_change_1h - a.quotes.USD.percent_change_1h)
      .slice(0, 3)
      .map(c => `📈 ${c.symbol}: +${c.quotes.USD.percent_change_1h.toFixed(2)}%`);
    const losers = [...coins]
      .sort((a, b) => a.quotes.USD.percent_change_1h - b.quotes.USD.percent_change_1h)
      .slice(0, 3)
      .map(c => `📉 ${c.symbol}: ${c.quotes.USD.percent_change_1h.toFixed(2)}%`);
    await channel.send(`🏆 **Top 3 (1h) Ganadoras/Perdedoras**:
${winners.join(' | ')}
${losers.join(' | ')}`);
  } catch (err) {
    console.error('❌ Error top movers:', err.message);
  }
}

// ————————— 4. Noticias filtradas por keyword —————————
const keywords = ['SEC','Binance','ETF','liquidation','Kraken'];
async function sendFilteredNews(channel) {
  try {
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    const items = feed.items.filter(item =>
      keywords.some(k => item.title.includes(k) || item.description?.includes(k))
    ).slice(0,5);
    if (!items.length) return;
    const out = items.map(i => `📰 [${i.title}](${i.link})`).join('\n');
    await channel.send(`🗞️ **Noticias Urgentes**:
${out}`);
  } catch (err) {
    console.error('❌ Error noticias filtradas:', err.message);
  }
}

// ————————— 5. Resumen diario de cierre —————————
async function sendDailySnapshot(channel) {
  try {
    const res = await axios.get('https://api.coinpaprika.com/v1/tickers');
    const top5 = res.data.filter(c => c.rank <=5)
      .map(c => `• ${c.symbol}: $${c.quotes.USD.price.toFixed(2)} (${c.quotes.USD.percent_change_24h.toFixed(2)}%)`)
      .join('\n');
    await channel.send(`⌛ **Resumen Diario (20:00)**:
${top5}`);
  } catch (err) {
    console.error('❌ Error resumen diario:', err.message);
  }
}

// —————— 6. Señales de futuros long/short ——————
async function checkFuturesSignals(channel) {
  try {
    // 1) Obtener velas BTCUSDT 1h (últimas 100)
    const klines = (await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol: 'BTCUSDT', interval: '1h', limit: 100 }
    })).data;

    const closes = klines.map(k => parseFloat(k[4]));

    // 2) Calcular EMA20 y EMA50
    const ema = (period, data) => {
      const k = 2/(period+1);
      return data.reduce((prev, price, i) =>
        i === 0 ? price
        : price * k + prev * (1-k)
      , data[0]);
    };
    const ema20 = ema(20, closes.slice(-50)); // últimos 50 para estabilizar
    const ema50 = ema(50, closes);

    // 3) Calcular RSI14
    const rsi = (period, data) => {
      let gains=0, losses=0;
      for (let i=1; i<=period; i++) {
        const diff = data[i] - data[i-1];
        if (diff>0) gains += diff; else losses -= diff;
      }
      const avgGain = gains/period, avgLoss = losses/period;
      const rs = avgGain/avgLoss || 0;
      return 100 - (100/(1+rs));
    };
    const rsi14 = rsi(14, closes.slice(-15));

    // 4) Funding Rate de BTC
    const fr = (await axios.get('https://fapi.binance.com/fapi/v1/premiumIndex', {
      params: { symbol: 'BTCUSDT' }
    })).data.lastFundingRate * 100; // en %

    // 5) Evaluar condiciones
    const longSignal = ema20 > ema50 && rsi14 < 30 && fr < 0;
    const shortSignal = ema20 < ema50 && rsi14 > 70 && fr > 0.02;

    // 6) Enviar alerta si coincide
    if (longSignal) {
      await channel.send(`🟢 **Señal LONG BTCUSD**\n• EMA20: ${ema20.toFixed(2)} > EMA50: ${ema50.toFixed(2)}\n• RSI14: ${rsi14.toFixed(1)} (<30)\n• Funding Rate: ${fr.toFixed(4)}% (<0)`);
    }
    if (shortSignal) {
      await channel.send(`🔴 **Señal SHORT BTCUSD**\n• EMA20: ${ema20.toFixed(2)} < EMA50: ${ema50.toFixed(2)}\n• RSI14: ${rsi14.toFixed(1)} (>70)\n• Funding Rate: ${fr.toFixed(4)}% (>0.02)`);
    }
  } catch (err) {
    console.error('❌ Error señales futuros:', err.message);
  }
}

module.exports.checkFuturesSignals = checkFuturesSignals;


module.exports = {
  checkWatchlist,
  checkBreakouts,
  getWinnersLosers,
  sendFilteredNews,
  sendDailySnapshot
};
