/**
 * market-features.js
 * Solo:
 * - checkWatchlist      → precios y %24h de tu lista
 * - sendFilteredNews    → top posts de r/CryptoCurrency
 * - checkFuturesSignals → señal LONG/SHORT con TP/SL
 */

require('dotenv').config();
const ccxt = require('ccxt');
const ti = require('technicalindicators');
const fetch = require('node-fetch');      // npm install node-fetch@2
const { EmbedBuilder } = require('discord.js');

// ───── Configuración ───────────────────────
const EXCHANGE_ID = process.env.EXCHANGE || 'binanceusdm';
const SYMBOL      = process.env.SYMBOL  || 'BTC/USDT';
const TIMEFRAME   = process.env.TIMEFRAME || '1h';  // cambiado a 1 hora
const CANDLES     = 250;
const WATCHLIST   = (process.env.WATCHLIST || SYMBOL).split(',').map(s => s.trim());

// ───── Conexión CCXT ───────────────────────
const exchange = new ccxt[EXCHANGE_ID]({ enableRateLimit: true });

// ───── 1) WATCHLIST: precios + %24h (cálculo con velas diarias) ───────
async function checkWatchlist(channel) {
  try {
    const lines = [];
    for (const sym of WATCHLIST) {
      let last, pct;
      try {
        const ohlcv = await exchange.fetchOHLCV(sym, '1d', undefined, 2);
        if (ohlcv.length >= 2) {
          const prevClose = ohlcv[0][4];
          last = ohlcv[1][4];
          pct = ((last - prevClose) / prevClose) * 100;
        } else {
          const tk = await exchange.fetchTicker(sym);
          last = tk.last;
          pct = typeof tk.percentage === 'number' ? tk.percentage : 0;
        }
      } catch {
        const tk = await exchange.fetchTicker(sym);
        last = tk.last;
        pct = typeof tk.percentage === 'number' ? tk.percentage : 0;
      }
      const arrow = pct > 0 ? '📈' : pct < 0 ? '📉' : '➡️';
      lines.push(`${arrow} **${sym}**: ${last.toFixed(2)} (${pct.toFixed(2)}%)`);
    }
    const embed = new EmbedBuilder()
      .setTitle('🔍 Watchlist')
      .setDescription(lines.join('\n'))
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('checkWatchlist error', err);
    await channel.send('❌ Error en Watchlist, revisa la consola.');
  }
}

// ───── 2) NEWS: top posts de r/CryptoCurrency (usa api.reddit.com)
async function sendFilteredNews(channel) {
  try {
    const res = await fetch(
      'https://api.reddit.com/r/CryptoCurrency/top?limit=3&t=day',
      {
        headers: {
          'User-Agent': 'MarketBot/1.0',
          'Accept': 'application/json'
        }
      }
    );
    if (!res.ok) {
      console.error('sendFilteredNews HTTP error', res.status, res.statusText);
      return channel.send('📰 No pude obtener noticias, status ' + res.status);
    }
    const { data: { children: posts } } = await res.json();
    if (!posts.length) {
      return channel.send('📰 No hay posts recientes en r/CryptoCurrency.');
    }
    const embed = new EmbedBuilder()
      .setTitle('📰 Top posts • r/CryptoCurrency (24h)')
      .setURL('https://reddit.com/r/CryptoCurrency/')
      .setTimestamp();
    posts.forEach(({ data: d }) => {
      embed.addFields({
        name: d.title.slice(0, 256),
        value: `⬆️ ${d.ups} • 💬 ${d.num_comments} • [link](https://reddit.com${d.permalink})`
      });
    });
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('sendFilteredNews error', err);
    await channel.send('❌ Error al obtener noticias, revisa la consola.');
  }
}


// ───── 3) FUTURES: señal LONG/SHORT + Entry/SL/TP${1}&TP${2} ─────────────
const fastPeriod = 12;
const slowPeriod = 26;
const rsiPeriod  = 14;
const rsiLong    = 55;
const rsiShort   = 45;
const colorMap   = { LONG: 0x2ecc71, SHORT: 0xe74c3c, 'NO TRADE': 0x95a5a6 };

async function checkFuturesSignals(channel) {
  try {
    if (!exchange.markets) await exchange.loadMarkets();
    const ohlcv = await exchange.fetchOHLCV(SYMBOL, TIMEFRAME, undefined, CANDLES);
    const closes = ohlcv.map(c => c[4]);

    const emaFast = ti.EMA.calculate({ period: fastPeriod, values: closes });
    const emaSlow = ti.EMA.calculate({ period: slowPeriod, values: closes });
    const macdArr = ti.MACD.calculate({
      values: closes,
      fastPeriod,
      slowPeriod,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
    const rsiArr = ti.RSI.calculate({ period: rsiPeriod, values: closes });

    const price = closes.at(-1);
    const emaF  = emaFast.at(-1);
    const emaS  = emaSlow.at(-1);
    const { MACD: macd, signal: macdSig } = macdArr.at(-1);
    const rsi   = rsiArr.at(-1);

    let dir = 'NO TRADE', reasons = [];
    if (emaF > emaS && macd > macdSig && rsi > rsiLong) {
      dir = 'LONG';
      reasons.push('EMA12 > EMA26', 'MACD alcista', `RSI ${rsi.toFixed(1)} > ${rsiLong}`);
    } else if (emaF < emaS && macd < macdSig && rsi < rsiShort) {
      dir = 'SHORT';
      reasons.push('EMA12 < EMA26', 'MACD bajista', `RSI ${rsi.toFixed(1)} < ${rsiShort}`);
    }

    const entry    = price;
    const stopLoss = emaS;
    const risk     = Math.abs(entry - stopLoss);
    let tp1 = null, tp2 = null;
    if (dir === 'LONG')  [tp1, tp2] = [entry + risk, entry + risk * 2];
    if (dir === 'SHORT') [tp1, tp2] = [entry - risk, entry - risk * 2];

    const embed = new EmbedBuilder()
      .setTitle(`Futures Signal • ${SYMBOL} • ${TIMEFRAME}`)
      .setColor(colorMap[dir])
      .setDescription(`**${dir}**\n${reasons.join('\n')}`)
      .addFields(
        { name: 'Entry',     value: entry.toFixed(2),           inline: true },
        { name: 'Stop-Loss', value: stopLoss.toFixed(2),        inline: true },
        { name: 'TP 1:1',    value: tp1  ? tp1.toFixed(2) : '—', inline: true },
        { name: 'TP 1:2',    value: tp2  ? tp2.toFixed(2) : '—', inline: true }
      )
      .setFooter({ text: 'No es asesoramiento financiero' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('checkFuturesSignals error', err);
    await channel.send('❌ Error al calcular señal de futuros, revisa logs.');
  }
}

module.exports = {
  checkWatchlist,
  sendFilteredNews,
  checkFuturesSignals
};
