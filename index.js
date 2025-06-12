// index.js – prueba instantánea de todos los módulos + cron + slash
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
  checkBreakouts,
  getWinnersLosers,
  sendFilteredNews,
  sendDailySnapshot,
  checkFuturesSignals,           // ¡asegúrate de exportarlo en market-features.js!
} = require('./market-features');

// ──────────────────────────────────────────────
// 1) Cliente Discord
// ──────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const CLIENT_ID  = process.env.CLIENT_ID;
const GUILD_ID   = process.env.GUILD_ID;

// ──────────────────────────────────────────────
// 2) Definición & registro de slash-commands
// ──────────────────────────────────────────────
const commandData = [
  new SlashCommandBuilder().setName('watchlist').setDescription('Chequea la watchlist ahora'),
  new SlashCommandBuilder().setName('breakouts').setDescription('Chequea breakouts ahora'),
  new SlashCommandBuilder().setName('gainerslosers').setDescription('Top ganadoras/perdedoras ahora'),
  new SlashCommandBuilder().setName('news').setDescription('Noticias urgentes ahora'),
  new SlashCommandBuilder().setName('snapshot').setDescription('Resumen diario inmediato'),
  new SlashCommandBuilder().setName('futures').setDescription('Señales de futuros ahora'),
].map(c => c.toJSON());

// registra al arrancar (guild = instantáneo; global = ~1 h)
(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('⬆️  Registrando slash-commands…');
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commandData },
      );
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandData });
    }
    console.log('✅ Slash-commands listos');
  } catch (err) {
    console.error('❌ Error registrando comandos', err);
  }
})();

// ──────────────────────────────────────────────
// 3) Ready → run once + cron
// ──────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`🚀 Bot conectado como ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);

  // ▶️  Ejecuta todos los módulos UNA VEZ para probarlos
  console.log('▶️  Ejecución inicial de todos los módulos');
  try {
    await checkWatchlist(channel);
    await checkBreakouts(channel);
    await getWinnersLosers(channel);
    await sendFilteredNews(channel);
    await sendDailySnapshot(channel);
    await checkFuturesSignals(channel);
    console.log('✅ Módulos iniciales completados');
  } catch (err) {
    console.error('❌ Error en la ejecución inicial', err);
  }

  // ⏰  Programación periódica (tus cron originales)
  cron.schedule('*/20 * * * *', () => checkWatchlist(channel));
  cron.schedule('*/30 * * * *', () => checkBreakouts(channel));
  cron.schedule('0 */2 * * *', () => getWinnersLosers(channel));
  cron.schedule('0 * * * *', () => sendFilteredNews(channel));
  cron.schedule('0 20 * * *', () => sendDailySnapshot(channel));
  cron.schedule('*/15 * * * *', () => checkFuturesSignals(channel));
});

// ──────────────────────────────────────────────
// 4) Handler de slash-commands
// ──────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // 1️⃣ Deferimos la respuesta (tienes hasta 15 minutos para editarla)
  await interaction.deferReply({ ephemeral: true });

  try {
    // 2️⃣ Ejecutas tu lógica normalmente
    const channel = await client.channels.fetch(CHANNEL_ID);
    switch (interaction.commandName) {
      case 'watchlist':
        await checkWatchlist(channel);
        break;
      case 'breakouts':
        await checkBreakouts(channel);
        break;
      case 'gainerslosers':
        await getWinnersLosers(channel);
        break;
      case 'news':
        await sendFilteredNews(channel);
        break;
      case 'snapshot':
        await sendDailySnapshot(channel);
        break;
      case 'futures':
        await checkFuturesSignals(channel);
        break;
    }

    // 3️⃣ Editamos la defer-reply para avisar al usuario
    await interaction.editReply('✅ Ejecutado correctamente.');
  } catch (err) {
    console.error(err);
    // Si hay error también editamos la respuesta deferred
    await interaction.editReply('❌ Hubo un error interno, revisa los logs.');
  }
});


// ──────────────────────────────────────────────
// 5) Login
// ──────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
