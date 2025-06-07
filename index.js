require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const features = require('./market-features');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const channelId = process.env.DISCORD_CHANNEL_ID;

client.once('ready', async () => {
  console.log('✅ Bot avanzado conectado a Discord');
  const channel = await client.channels.fetch(channelId);

  cron.schedule('0 * * * *',     () => features.sendHeatmap(channel));           // cada hora
  cron.schedule('0 */2 * * *',   () => features.sendSupportResistance(channel));// cada 2h
  cron.schedule('*/30 * * * *',  () => features.checkBreakouts(channel));       // cada 30m
  cron.schedule('0 */20 * * *',  () => features.checkWatchlist(channel));       // cada 20m
  cron.schedule('0 */3 * * *',   () => features.checkPatterns(channel));        // cada 3h
  cron.schedule('0 8 * * *',     () => features.sendDailySummary(channel,'pre'));  // 08:00
  cron.schedule('0 20 * * *',    () => features.sendDailySummary(channel,'post'));// 20:00
  cron.schedule('40 10 * * *',   () => features.sendCryptoNews(channel));       // 10:40

});

client.login(process.env.DISCORD_TOKEN);
