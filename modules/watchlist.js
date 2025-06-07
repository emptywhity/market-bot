// modules/watchlist.js
const axios = require('axios');

// Lista de monedas que quieres vigilar con su umbral de alerta en %
const watchlist = [
  { id: 'bitcoin', symbol: 'BTC', threshold: 1.5 },
  { id: 'ethereum', symbol: 'ETH', threshold: 2 },
  { id: 'solana', symbol: 'SOL', threshold: 3 },
];

async function checkWatchlist(channel) {
  try {
    const ids = watchlist.map(c => c.id).join(',');
    const url = `https://api.coingecko.com/api/v3/coins/markets`;
    const { data } = await axios.get(url, {
      params: {
        vs_currency: 'usd',
        ids,
        price_change_percentage: '1h',
      },
    });

    const alerts = data
      .map(coin => {
        const tracked = watchlist.find(c => c.id === coin.id);
        const change = coin.price_change_percentage_1h_in_currency;

        if (Math.abs(change) >= tracked.threshold) {
          const direction = change > 0 ? '🔼 subido' : '🔻 bajado';
          return `🚨 ${tracked.symbol} ha ${direction} ${change.toFixed(2)}% en la última hora (precio: $${coin.current_price})`;
        }

        return null;
      })
      .filter(msg => msg);

    if (alerts.length > 0) {
      await channel.send(`📈 **Alerta por variación porcentual:**\n${alerts.join('\n')}`);
    } else {
      console.log("✅ No hubo movimientos importantes en la watchlist.");
    }

  } catch (error) {
    console.error("❌ Error al vigilar la watchlist:", error.message);
  }
}

module.exports = { checkWatchlist };
