// index.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

const { sendHeatmap } = require('./modules/heatmap');
const { sendSupportResistance } = require('./modules/support');
const { checkBreakouts } = require('./modules/breakouts');
const { sendAINewsSummary } = require('./modules/ai-news');
const { checkPatterns } = require('./modules/patterns');
const { sendDailySummary } = require('./modules/summary');
const { checkWatchlist } = require('./modules/watchlist');


const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const channelId = process.env.DISCORD_CHANNEL_ID;

client.once('ready', async () => {
  console.log('✅ Bot avanzado conectado a Discord');
  const channel = await client.channels.fetch(channelId);

  // Cada hora: mapa de calor
  cron.schedule('0 * * * *', () => sendHeatmap(channel));

  // Cada 2 horas: soporte/resistencia
  cron.schedule('0 */2 * * *', () => sendSupportResistance(channel));

  // Cada 30 minutos: ruptura de rangos
  cron.schedule('*/30 * * * *', () => checkBreakouts(channel));

  // resumen 
  cron.schedule('0 20 * * *', () => sendAINewsSummary(channel));

  // Cada 3 horas: detección de patrones
  cron.schedule('0 */3 * * *', () => checkPatterns(channel));

  // Cada hora: verificación de watchlist
  cron.schedule('0 * * * *', () => checkWatchlist(channel));

  // 08:00 y 20:00 resumen diario
  cron.schedule('0 8 * * *', () => sendDailySummary(channel, 'pre'));
  cron.schedule('0 20 * * *', () => sendDailySummary(channel, 'post'));
});

client.login(process.env.DISCORD_TOKEN);
