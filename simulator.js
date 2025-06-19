/**
 * simulator.js  –  Paper-trading con:
 * • Banca inicial (initBalance)
 * • % de riesgo por operación (riskPct)
 * • Comisiones (feePct)
 * • Apalancamiento (leverage)
 * • Historial completo de trades + estadísticas básicas
 *
 * El estado se persiste en sim_state.json
 */
const fs   = require('fs');
const path = require('path');
const STATE_FILE = path.join(__dirname, 'sim_state.json');

// ——— CONFIGURACIÓN GENERAL ————————————————————————————
const CONFIG = {
  initBalance : 100,        // USDT
  riskPct     : 1,          // % balance arriesgado por trade
  feePct      : 0.04 / 100, // 0.04 % taker
  leverage    : 3           // multiplicador de posición
};

// ——— ESTRUCTURA DEL ESTADO ————————————————————————————
const DEFAULT_STATE = {
  balance : CONFIG.initBalance, // banca disponible
  equity  : CONFIG.initBalance, // equity (≈ balance si no hay flotante)
  open    : null,               // trade abierto o null
  trades  : []                  // historial
};

// ↓ utilidades de carga / guardado
function load () {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { ...DEFAULT_STATE }; }
}
function save (s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

// ——— API PÚBLICA —————————————————————————————————————————

// ☑️ abrir trade (solo si no hay otro)
function open (dir, entry, tp1, tp2, sl) {
  const s = load();
  if (s.open) return false;                    // ya hay trade

  const risk     = CONFIG.riskPct / 100 * s.balance;
  const stopDist = Math.abs(entry - sl);
  if (!stopDist) return false;

  // Qty ajustada a leverage
  const qty = +( (risk / stopDist) * CONFIG.leverage ).toFixed(6);

  const feeIn = entry * qty * CONFIG.feePct;
  s.equity -= feeIn;                           // cobra comisión de entrada

  s.open = { dir, entry, tp1, tp2, sl, qty, feeIn, peakEq: s.equity,
             tsOpen: Date.now() };
  save(s);
  return true;
}

// ☑️ cierre automático si se toca TP/SL
function check (price) {
  const s = load();
  const t = s.open;
  if (!t) return null;

  // ¿qué nivel se ha tocado?
  const hitTP2 = t.dir === 'LONG' ? price >= t.tp2 : price <= t.tp2;
  const hitTP1 = t.dir === 'LONG' ? price >= t.tp1 : price <= t.tp1;
  const hitSL  = t.dir === 'LONG' ? price <= t.sl  : price >= t.sl;

  let tag = null;
  if      (hitTP2) tag = 'TP2';
  else if (hitTP1) tag = 'TP1';
  else if (hitSL ) tag = 'SL';

  return tag ? close(price, tag) : null;
}

// ☑️ actualizar equity-máxima para drawdown
function trailPeak (eq) {
  const s = load();
  if (s.open && eq > s.open.peakEq) {
    s.open.peakEq = eq;
    save(s);
  }
}

// ☑️ stats agregadas
function stats () {
  const s = load();
  const wins    = s.trades.filter(t => t.net > 0);
  const losses  = s.trades.filter(t => t.net <= 0);
  const exp     = s.trades.length
      ? (wins.reduce((a,t)=>a+t.net,0)+losses.reduce((a,t)=>a+t.net,0)) / s.trades.length
      : 0;

  // max drawdown usando equity pico de cada trade
  const { dd:maxDD } = s.trades.reduce((acc,t) => {
    acc.peak = Math.max(acc.peak, t.peakEq);
    const dd = 1 - (t.peakEq + t.net) / acc.peak;
    return { peak: acc.peak, dd: Math.max(acc.dd, dd) };
  }, { peak: CONFIG.initBalance, dd: 0 });

  return {
    balance   : +s.balance.toFixed(2),
    open      : s.open,
    trades    : s.trades.length,
    winRate   : wins.length / Math.max(s.trades.length,1) * 100,
    expectancy: +exp.toFixed(2),
    maxDD     : +(maxDD*100).toFixed(1)
  };
}

// ——— helpers internos ————————————————————————————————
function close (price, tag) {
  const s = load();
  const t = s.open;
  const pnl = t.dir === 'LONG' ? (price - t.entry) * t.qty
                               : (t.entry - price) * t.qty;
  const feeOut = price * t.qty * CONFIG.feePct;
  const net    = pnl - t.feeIn - feeOut;

  s.balance = +(s.balance + net).toFixed(2);
  s.equity  = s.balance;

  s.trades.push({ ...t, exit: price, tag,
                  pnl: +pnl.toFixed(2), net: +net.toFixed(2),
                  tsClose: Date.now() });
  s.open = null;
  save(s);
  return { tag, net };
}

module.exports = { open, check, trailPeak, stats };
