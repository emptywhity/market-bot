/**
 * market-features.js  –  Watchlist · News · Futures + simulador
 */
require('dotenv').config();
const ccxt           = require('ccxt');
const ti             = require('technicalindicators');
const fetch          = require('node-fetch');   // v2
const { EmbedBuilder } = require('discord.js');
const sim            = require('./simulator');  // ← nuevo

// ——— Variables de entorno / defaults ————————————————
const EXCHANGE_ID = process.env.EXCHANGE   || 'binanceusdm';
const SYMBOL      = process.env.SYMBOL     || 'BTC/USDT';
const TIMEFRAME   = process.env.TIMEFRAME  || '1h';
const CANDLES     = 250;
const WATCHLIST   = (process.env.WATCHLIST || SYMBOL)
                    .split(',').map(s => s.trim());

const exchange = new ccxt[EXCHANGE_ID]({ enableRateLimit: true });

// ————————————————————————————————————————————————
// 1) WATCHLIST
async function checkWatchlist(channel) {
  try {
    const rows = [];
    for (const sym of WATCHLIST) {
      let last, pct;
      try {
        const ohlcv = await exchange.fetchOHLCV(sym,'1d',undefined,2);
        if (ohlcv.length >= 2) {
          const prev = ohlcv[0][4];
          last = ohlcv[1][4];
          pct  = (last - prev) / prev * 100;
        }
      } catch (e) { /* fallback ticker */ }
      if (last === undefined) {
        const tk = await exchange.fetchTicker(sym);
        last = tk.last;
        pct  = +tk.percentage || 0;
      }
      const arrow = pct>0?'📈':pct<0?'📉':'➡️';
      rows.push(`${arrow} **${sym}**: ${last.toFixed(2)} (${pct.toFixed(2)} %)`);
    }
    const embed = new EmbedBuilder().setTitle('🔍 Watchlist')
                                    .setDescription(rows.join('\n'))
                                    .setTimestamp();
    await channel.send({ embeds:[embed] });
  } catch (err) {
    console.error('watchlist', err);
    await channel.send('❌ Error en Watchlist.');
  }
}

// ————————————————————————————————————————————————
// 2) REDDIT NEWS
async function sendFilteredNews(channel) {
  try {
    const r = await fetch(
      'https://www.reddit.com/r/CryptoCurrency/top.json?limit=3&t=day&raw_json=1',
      { headers:{ 'User-Agent':'MarketBot/1.0','Accept':'application/json' }});
    if(!r.ok) return channel.send('📰 Error '+r.status);
    const json = await r.json();
    const embed = new EmbedBuilder()
      .setTitle('📰 Top r/CryptoCurrency (24 h)')
      .setURL('https://reddit.com/r/CryptoCurrency/')
      .setTimestamp();

    json.data.children.forEach(({data:d}) =>
      embed.addFields({
        name : d.title.slice(0,256),
        value: `⬆️ ${d.ups} • 💬 ${d.num_comments} • [link](https://reddit.com${d.permalink})`
      }));
    await channel.send({ embeds:[embed] });
  } catch(e){
    console.error('news',e);
    await channel.send('❌ Error al obtener noticias.');
  }
}

// ————————————————————————————————————————————————
// 3) FUTURES + SIMULADOR
const fastPeriod = 12, slowPeriod = 26;
const rsiPeriod = 14, rsiLong = 55, rsiShort = 45;
const color = { LONG:0x2ecc71, SHORT:0xe74c3c, 'NO TRADE':0x95a5a6 };

async function checkFuturesSignals(channel){
  try{
    if(!exchange.markets) await exchange.loadMarkets();
    const ohlcv = await exchange.fetchOHLCV(SYMBOL, TIMEFRAME, undefined, CANDLES);
    const closes = ohlcv.map(c=>c[4]);
    const emaF = ti.EMA.calculate({period:fastPeriod, values:closes}).at(-1);
    const emaS = ti.EMA.calculate({period:slowPeriod,values:closes}).at(-1);
    const macd = ti.MACD.calculate({
      values:closes, fastPeriod, slowPeriod, signalPeriod:9
    }).at(-1);
    const rsi  = ti.RSI.calculate({period:rsiPeriod, values:closes}).at(-1);
    const price= closes.at(-1);

    let dir='NO TRADE', reasons=[];
    if (emaF>emaS && macd.MACD>macd.signal && rsi>rsiLong){
      dir='LONG'; reasons=['EMA12>26','MACD↑',`RSI ${rsi.toFixed(1)}>`+rsiLong];
    }else if(emaF<emaS && macd.MACD<macd.signal && rsi<rsiShort){
      dir='SHORT';reasons=['EMA12<26','MACD↓',`RSI ${rsi.toFixed(1)}<`+rsiShort];
    }

    const stopLoss=emaS;
    const risk=Math.abs(price-stopLoss);
    const tp1 = dir==='LONG' ? price + risk : dir==='SHORT' ? price - risk : null;
    const tp2 = dir==='LONG' ? price + risk*2 : dir==='SHORT'? price - risk*2 : null;

    // ——— simulador —————————————————————————
    sim.trailPeak(sim.stats().balance);
    const closed = sim.check(price);                // ¿cerramos trade previo?
    if(!sim.stats().open && dir!=='NO TRADE')       // ¿abrimos nuevo?
      sim.open(dir, price, tp1, tp2, stopLoss);

    // ——— embed ————————————————————————————
    const st = sim.stats();
    const embed = new EmbedBuilder()
      .setTitle(`Futures Signal • ${SYMBOL} • ${TIMEFRAME}`)
      .setColor(color[dir])
      .setDescription(`**${dir}**\n${reasons.join('\n')||'Sin confluencia'}`)
      .addFields(
        {name:'Entry', value:price.toFixed(2), inline:true},
        {name:'SL',    value:stopLoss.toFixed(2), inline:true},
        {name:'TP1',   value:tp1?tp1.toFixed(2):'—', inline:true},
        {name:'TP2',   value:tp2?tp2.toFixed(2):'—', inline:true},
        {name:'Balance', value:`${st.balance} USDT`, inline:true}
      )
      .setFooter({text:'Paper-trading · no advice'}).setTimestamp();

    if (closed)
      embed.addFields({name:'Trade Closed',
                       value:`${closed.tag} | net ${closed.net.toFixed(2)} USDT`});
    if (st.open)
      embed.addFields({name:'Trade Open',
                       value:`${st.open.dir} @ ${st.open.entry}`});

    await channel.send({ embeds:[embed] });
  }catch(err){
    console.error('futures',err);
    await channel.send('❌ Error señal futuros.');
  }
}

// ————————————————————————————————————————————————
function getSimStats(channel){
  const s=sim.stats();
  const lines=[
    `💰 Balance: **${s.balance} USDT**`,
    s.open
     ? `📈 Posición: **${s.open.dir}** @ ${s.open.entry} | SL ${s.open.sl}`
     : '✅ Sin posiciones abiertas.',
    `📊 Trades: ${s.trades} | Win-rate: ${s.winRate.toFixed(1)} % | ` +
    `Expectancy: ${s.expectancy} USDT | Max DD: ${s.maxDD} %`
  ];
  const embed = new EmbedBuilder().setTitle('🧪 Simulator')
                                  .setDescription(lines.join('\n'))
                                  .setTimestamp();
  return channel.send({embeds:[embed]});
}

module.exports = {
  checkWatchlist,
  sendFilteredNews,
  checkFuturesSignals,
  getSimStats
};
