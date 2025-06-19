// index.js – Slash-commands + cron + simulador
require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder,
        REST, Routes } = require('discord.js');
const cron = require('node-cron');

const {
  checkWatchlist,
  sendFilteredNews,
  checkFuturesSignals,
  getSimStats
} = require('./market-features');

const TOKEN      = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const CLIENT_ID  = process.env.CLIENT_ID;
const GUILD_ID   = process.env.GUILD_ID;

if (!TOKEN || !CHANNEL_ID || !CLIENT_ID) {
  console.error('❌ Config faltante (TOKEN / CHANNEL_ID / CLIENT_ID)');
  process.exit(1);
}

// ——— Cliente (solo Guilds) —————————————————————
const client = new Client({ intents:[GatewayIntentBits.Guilds] });

// ——— Registro de slash-commands ——————————————
(async ()=>{
  const rest = new REST({version:'10'}).setToken(TOKEN);
  const cmds = [
    ['watchlist',  'Chequea tu watchlist'],
    ['news',       'Top posts r/CryptoCurrency'],
    ['futures',    'Señal BTC/USDT'],
    ['sim',        'Estado del simulador'],
    ['simstats',   'Métricas del simulador']
  ].map(([n,d])=> new SlashCommandBuilder().setName(n).setDescription(d).toJSON());

  const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

  console.log('⬆️  Registrando slash-commands…');
  await rest.put(route, { body:cmds });
  console.log('✅ Comandos listos.');
})().catch(console.error);

// ——— Al conectar: cron-jobs ——————————————
client.once('ready', async ()=>{
  console.log(`🚀 Bot conectado como ${client.user.tag}`);
  const ch = await client.channels.fetch(CHANNEL_ID);
  cron.schedule('*/20 * * * *', ()=>checkWatchlist(ch));     // 20 min
  cron.schedule('0 0,8,16 * * *', ()=>sendFilteredNews(ch)); // 3 veces/día
  cron.schedule('0 * * * *', ()=>checkFuturesSignals(ch));   // cada hora
  console.log('⏰ Cron-jobs en marcha.');
});

// ——— Manejador de slash-commands ————————————
client.on('interactionCreate', async inter=>{
  if (!inter.isChatInputCommand()) return;
  await inter.deferReply({flags:64}).catch(()=>{});

  let reply={ content:'✅ Listo.', flags:64 };
  try{
    const ch = await client.channels.fetch(CHANNEL_ID);
    switch(inter.commandName){
      case 'watchlist': await checkWatchlist(ch);  break;
      case 'news':      await sendFilteredNews(ch);break;
      case 'futures':   await checkFuturesSignals(ch);break;
      case 'sim':       await getSimStats(ch); break;
      case 'simstats':  await getSimStats(ch); break;
      default: reply={content:'❓ Comando no reconocido.',flags:64};
    }
  }catch(e){
    console.error(e);
    reply={content:'❌ Error interno.', flags:64};
  }
  await inter.editReply(reply).catch(()=>inter.followUp?.(reply).catch(()=>{}));
});

// ——— safety ——————————————————————————————
process.on('unhandledRejection', err=>console.error('Unhandled', err));

// ——— login ————————————————————————————————
client.login(TOKEN);
