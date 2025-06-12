// index.js – Solo slash-commands + cron para Watchlist, News y Futures
require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
} = require('discord.js');
const cron = require('node-cron');

const {
  checkWatchlist,
  sendFilteredNews,
  checkFuturesSignals,
} = require('./market-features');

const TOKEN      = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const CLIENT_ID  = process.env.CLIENT_ID;
const GUILD_ID   = process.env.GUILD_ID;

if (!TOKEN || !CHANNEL_ID || !CLIENT_ID) {
  console.error('❌ Faltan DISCORD_TOKEN, DISCORD_CHANNEL_ID o CLIENT_ID en .env');
  process.exit(1);
}

// 1) Cliente con sólo Guilds intent
const client = new Client({
  intents: [ GatewayIntentBits.Guilds ]
});

// 2) Registro de slash-commands (sólo 3)
(async () => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const cmds = [
    ['watchlist', 'Chequea tu watchlist ahora'],
    ['news',      'Muestra top posts de r/CryptoCurrency'],
    ['futures',   'Señal de futuros LONG/SHORT con TP/SL'],
  ].map(([name, desc]) =>
    new SlashCommandBuilder().setName(name).setDescription(desc).toJSON()
  );

  try {
    console.log('⬆️  Registrando slash-commands…');
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);
    // limpia y registra
    await rest.put(route, { body: cmds });
    console.log('✅ Slash-commands listos: watchlist, news, futures');
  } catch (err) {
    console.error('❌ Error registrando slash-commands:', err);
  }
})();

// 3) Al conectar → programa cron-jobs
client.once('ready', async () => {
  console.log(`🚀 Bot conectado como ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  cron.schedule('*/20 * * * *', () => checkWatchlist(channel));
  cron.schedule('0 * * * *',    () => sendFilteredNews(channel));
  cron.schedule('*/15 * * * *', () => checkFuturesSignals(channel));

  console.log('⏰ Cron-jobs programados: watchlist (20m), news (hora), futures (15m)');
});

// 4) Manejador de interacciones (slash)
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // defer para ganar tiempo
  await interaction.deferReply({ flags: 64 }).catch(() => {});

  let reply = { content: '✅ Ejecutado correctamente.', flags: 64 };
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    switch (interaction.commandName) {
      case 'watchlist':
        await checkWatchlist(channel);
        break;
      case 'news':
        await sendFilteredNews(channel);
        break;
      case 'futures':
        await checkFuturesSignals(channel);
        break;
      default:
        reply = { content: '❓ Comando no reconocido.', flags: 64 };
    }
  } catch (err) {
    console.error('❌ Error al ejecutar comando:', err);
    reply = { content: '❌ Error interno.', flags: 64 };
  }

  // intenta editar la deferred reply, si falla hace followUp
  await interaction.editReply(reply).catch(() =>
    interaction.followUp?.(reply).catch(() => {})
  );
});

// 5) Evita caídas por promesas no manejadas
process.on('unhandledRejection', error => {
  console.error('❗ Unhandled promise rejection:', error);
});

// 6) Login
client.login(TOKEN);
