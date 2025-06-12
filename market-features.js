/**
 * market-features.js
 * Módulos para tu MarketBot:
 * - checkWatchlist       → precios y %24h de tu lista
 * - checkBreakouts       → detecta ruptura de máximos recientes
 * - getWinnersLosers     → top 5 ganadoras y perdedoras 24h
 * - sendFilteredNews     → últimas 3 noticias cripto (NewsAPI)
 * - sendDailySnapshot    → snapshot diario (watchlist + movers)
 * - checkFuturesSignals  → señal LONG/SHORT/NO TRADE (ya la tenías)
 */

require('dotenv').config();
const ccxt = require('ccxt');
const ti = require('technicalindicators');
const fetch = require('node-fetch');            // npm install node-fetch@2
const { EmbedBuilder } = require('discord.js');

// ───────────────────────────────────────────────────────────
// Configuración
// ───────────────────────────────────────────────────────────
const EXCHANGE_ID = process.env.EXCHANGE || 'binanceusdm';
const SYMBOL      = process.env.SYMBOL || 'BTC/USDT';
const TIMEFRAME   = process.env.TIMEFRAME || '5m';
const CANDLES     = 250;
const WATCHLIST   = (process.env.WATCHLIST || SYMBOL).split(',').map(s => s.trim());
const NEWS_KEY    = process.env.NEWS_API_KEY || '';

// ───────────────────────────────────────────────────────────
// Conexión CCXT
// ───────────────────────────────────────────────────────────
const exchange = new ccxt[EXCHANGE_ID]({ enableRateLimit: true });

// ───────────────────────────────────────────────────────────
// 1) WATCHLIST: precio + %24h
// ───────────────────────────────────────────────────────────
async function checkWatchlist(channel) {
  try {
    const data = await Promise.all(
      WATCHLIST.map(async sym => {
        const tk = await exchange.fetchTicker(sym);
        return { sym, last: tk.last, change: tk.percentage };
      })
    );
    const embed = new EmbedBuilder()
      .setTitle('🔍 Watchlist')
      .setTimestamp();
    data.forEach(d =>
      embed.addFields({
        name: d.sym,
        value: `Precio: ${d.last}\n24h: ${d.change?.toFixed(2) ?? 'N/A'}%`,
        inline: true
      })
    );
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('checkWatchlist error', err);
    await channel.send('❌ Error en Watchlist, revisa la consola.');
  }
}

// ───────────────────────────────────────────────────────────
// 2) BREAKOUTS: última vela rompe máximo de n previas
// ───────────────────────────────────────────────────────────
async function checkBreakouts(channel) {
  try {
    const lines = [];
    for (const sym of WATCHLIST) {
      const ohlcv = await exchange.fetchOHLCV(sym, TIMEFRAME, undefined, 21);
      const highs = ohlcv.map(c => c[2]);
      const closes = ohlcv.map(c => c[4]);
      const prevMax = Math.max(...highs.slice(0, -1));
      const lastClose = closes.at(-1);
      if (lastClose > prevMax) {
        lines.push(`🚀 **${sym}**: rompió ${prevMax.toFixed(2)} (cierre ${lastClose.toFixed(2)})`);
      }
    }
    if (!lines.length) {
      await channel.send('🚫 No hay breakouts en tu Watchlist.');
    } else {
      await channel.send(lines.join('\n'));
    }
  } catch (err) {
    console.error('checkBreakouts error', err);
    await channel.send('❌ Error en Breakouts, revisa la consola.');
  }
}

// ───────────────────────────────────────────────────────────
// 3) WINNERS/LOSERS: top 5 por %24h
// ───────────────────────────────────────────────────────────
async function getWinnersLosers(channel) {
  try {
    const tickers = await exchange.fetchTickers();
    // Solo pares USDT y calculamos el cambio
    const arr = Object.values(tickers)
      .filter(t => t.symbol.endsWith('/USDT'))
      .map(t => {
        // Si no viene t.percentage, lo calculamos
        const pct = typeof t.percentage === 'number'
          ? t.percentage
          : ((t.last - t.open) / t.open) * 100;
        return { symbol: t.symbol, pct };
      });

    // Orden descendente por pct
    arr.sort((a, b) => b.pct - a.pct);

    const top5 = arr.slice(0, 5);
    const bot5 = arr.slice(-5).reverse();

    const embed = new EmbedBuilder()
      .setTitle('🏆 Top 5 Ganadoras / Perdedoras 24 h')
      .addFields(
        {
          name: 'Ganadoras',
          value: top5.map(t => `${t.symbol}: ${t.pct.toFixed(2)}%`).join('\n'),
          inline: true
        },
        {
          name: 'Perdedoras',
          value: bot5.map(t => `${t.symbol}: ${t.pct.toFixed(2)}%`).join('\n'),
          inline: true
        }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('getWinnersLosers error', err);
    await channel.send('❌ Error en Gainers/Losers, revisa la consola.');
  }
}

// ───────────────────────────────────────────────────────────
// 4) NEWS: últimas 3 noticias de Crypto (NewsAPI.org)
// ───────────────────────────────────────────────────────────
async function sendFilteredNews(channel) {
  try {
    // 1) Llamada a Reddit JSON
    const res = await fetch(
      'https://www.reddit.com/r/CryptoCurrency/top.json?limit=3&t=day',
      { headers: { 'User-Agent': 'MarketBot/1.0' } }
    );
    const j = await res.json();
    const posts = j.data.children;

    if (!posts || !posts.length) {
      return channel.send('📰 No hay posts recientes en r/CryptoCurrency.');
    }

    // 2) Construye embed
    const embed = new EmbedBuilder()
      .setTitle('📰 Top posts • r/CryptoCurrency (24h)')
      .setURL('https://www.reddit.com/r/CryptoCurrency/')
      .setTimestamp();

    posts.forEach(p => {
      const d = p.data;
      embed.addFields({
        name: d.title.slice(0, 256),
        value: `⬆️ ${d.ups} • 💬 ${d.num_comments} • [ver link](https://reddit.com${d.permalink})`
      });
    });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('sendFilteredNews error', err);
    await channel.send('❌ Error al obtener noticias de Reddit, revisa la consola.');
  }
}

// ───────────────────────────────────────────────────────────
// 5) SNAPSHOT DIARIO: combina Watchlist + Gainers/Losers
// ───────────────────────────────────────────────────────────
async function sendDailySnapshot(channel) {
  try {
    // —— Parte 1: Watchlist —— (igual que antes)
    const wlEmbed = new EmbedBuilder()
      .setTitle('📊 Daily Snapshot • Watchlist')
      .setTimestamp();
    const wlLines = await Promise.all(
      WATCHLIST.map(async sym => {
        const tk = await exchange.fetchTicker(sym);
        const pct = typeof tk.percentage === 'number'
          ? tk.percentage
          : ((tk.last - tk.open) / tk.open) * 100;
        return `${sym}: ${tk.last} (${pct.toFixed(1)}%)`;
      })
    );
    wlEmbed.addFields({ name: 'Precios', value: wlLines.join('\n') });

    // —— Parte 2: Movers ——  
    const tickers = await exchange.fetchTickers();
    const movers = Object.values(tickers)
      .filter(t => t.symbol.endsWith('/USDT'))
      .map(t => {
        const pct = typeof t.percentage === 'number'
          ? t.percentage
          : ((t.last - t.open) / t.open) * 100;
        return { symbol: t.symbol, pct };
      })
      .sort((a, b) => b.pct - a.pct);

    const moversEmbed = new EmbedBuilder()
      .setTitle('📊 Daily Snapshot • Movers')
      .setTimestamp()
      .addFields(
        {
          name: 'Top 3',
          value: movers.slice(0, 3).map(t => `${t.symbol}: ${t.pct.toFixed(1)}%`).join('\n'),
          inline: true
        },
        {
          name: 'Bot 3',
          value: movers.slice(-3).reverse().map(t => `${t.symbol}: ${t.pct.toFixed(1)}%`).join('\n'),
          inline: true
        }
      );

    // Enviamos ambos embeds de una vez
    await channel.send({ embeds: [wlEmbed, moversEmbed] });
  } catch (err) {
    console.error('sendDailySnapshot error', err);
    await channel.send('❌ Error en Snapshot, revisa la consola.');
  }
}

// ───────────────────────────────────────────────────────────
// 6) Fututes (lo tenías ya)
// ───────────────────────────────────────────────────────────
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

    // indicadores
    const emaFast = ti.EMA.calculate({ period: fastPeriod, values: closes });
    const emaSlow = ti.EMA.calculate({ period: slowPeriod, values: closes });
    const macdArr = ti.MACD.calculate({ values: closes, fastPeriod, slowPeriod, signalPeriod: 9 });
    const rsiArr  = ti.RSI.calculate({ period: rsiPeriod, values: closes });

    // últimos valores
    const idx     = closes.length - 1;
    const price   = closes[idx];
    const emaF    = emaFast[emaFast.length - 1];
    const emaS    = emaSlow[emaSlow.length - 1];
    const { MACD: macd, signal: macdSig } = macdArr[macdArr.length - 1];
    const rsi     = rsiArr[rsiArr.length - 1];

    // dirección y motivos
    let dir = 'NO TRADE', reasons = [];
    if (emaF > emaS && macd > macdSig && rsi > rsiLong) {
      dir = 'LONG';
      reasons.push('EMA12 > EMA26', 'MACD alcista', `RSI ${rsi.toFixed(1)} > ${rsiLong}`);
    } else if (emaF < emaS && macd < macdSig && rsi < rsiShort) {
      dir = 'SHORT';
      reasons.push('EMA12 < EMA26', 'MACD bajista', `RSI ${rsi.toFixed(1)} < ${rsiShort}`);
    }
    // funding info (opcional)
    let funding = '';
    if (exchange.has['fetchFundingRate']) {
      try {
        const fr = await exchange.fetchFundingRate(SYMBOL);
        funding = `• Funding ${(fr.fundingRate * 100).toFixed(4)}%`;
        reasons.push(funding);
      } catch {}
    }

    // proponemos Entry / SL
    const entry = price;
    const stopLoss = emaS; 
    const risk = Math.abs(entry - stopLoss);
    let tp1 = null, tp2 = null;
    if (dir === 'LONG') {
      tp1 = entry + risk;       // TP1 = entry + riesgo
      tp2 = entry + risk * 2;   // TP2 = entry + 2×riesgo
    } else if (dir === 'SHORT') {
      tp1 = entry - risk;       // TP1 = entry - riesgo
      tp2 = entry - risk * 2;   // TP2 = entry - 2×riesgo
    }

    // construye embed
    const embed = new EmbedBuilder()
      .setTitle(`Futures Signal • ${SYMBOL} • ${TIMEFRAME}`)
      .setColor(colorMap[dir])
      .setDescription(`**${dir}**\n${reasons.join('\n')}`)
      .addFields(
        { name: 'Entry',     value: entry.toFixed(2),           inline: true },
        { name: 'Stop-Loss', value: stopLoss.toFixed(2),       inline: true },
        { name: 'TP 1:1',    value: tp1  ? tp1.toFixed(2) : '—', inline: true },
        { name: 'TP 1:2',    value: tp2  ? tp2.toFixed(2) : '—', inline: true },
        { name: 'EMA12',     value: emaF.toFixed(2),           inline: true },
        { name: 'EMA26',     value: emaS.toFixed(2),           inline: true },
        { name: 'MACD',      value: macd.toFixed(2),           inline: true },
        { name: 'Signal',    value: macdSig.toFixed(2),        inline: true },
        { name: 'RSI',       value: rsi.toFixed(1),            inline: true }
      )
      .setFooter({ text: 'No es asesoramiento financiero' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('checkFuturesSignals error', err);
    await channel.send('❌ Error al calcular señal de futuros, revisa logs.');
  }
}

// ───────────────────────────────────────────────────────────
module.exports = {
  checkWatchlist,
  checkBreakouts,
  getWinnersLosers,
  sendFilteredNews,
  sendDailySnapshot,
  checkFuturesSignals
};
