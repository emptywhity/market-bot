require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const { checkWatchlist, checkBreakouts, getWinnersLosers, sendFilteredNews, sendDailySnapshot } = require('./market-features');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const CH = process.env.DISCORD_CHANNEL_ID;

client.once('ready', async () => {
  console.log('✅ Bot rentable conectado');
  const channel = await client.channels.fetch(CH);

  // 1) Watchlist cada 20m
  cron.schedule('*/20 * * * *', () => checkWatchlist(channel));

  // 2) Breakouts cada 30m
  cron.schedule('*/30 * * * *', () => checkBreakouts(channel));

  // 3) Top ganadoras/perdedoras cada 2h
  cron.schedule('0 */2 * * *', () => getWinnersLosers(channel));

  // 4) Noticias urgentes cada hora
  cron.schedule('0 * * * *', () => sendFilteredNews(channel));

  // 5) Resumen diario a las 20:00
  cron.schedule('0 20 * * *', () => sendDailySnapshot(channel));

  // Cada 15 minutos comprobamos señales de futuros
  cron.schedule('*/15 * * * *', () => features.checkFuturesSignals(channel));

});

client.login(process.env.DISCORD_TOKEN);
