// email.js — sends notifications. If SMTP isn't configured, it logs to the
// console so the full flow still works in development without email setup.
import nodemailer from 'nodemailer';

let transport = null;
if (process.env.SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
}
const FROM = process.env.MAIL_FROM || 'SwitchBored <no-reply@switchbored.local>';

async function send(to, subject, text) {
  if (!transport) { console.log(`\n[email → ${to}] ${subject}\n${text}\n`); return; }
  try { await transport.sendMail({ from: FROM, to, subject, text }); }
  catch (e) { console.error('Email failed:', e.message); }
}

export function notifySellerOfSale({ seller, buyer, gameName, productName, itemNotes, marketGold, buyerInGameName }) {
  const body =
    `Good news — someone bought your listing.\n\n` +
    `Game: ${gameName}\nItem: ${productName}${itemNotes ? ` (${itemNotes})` : ''}\n` +
    `You will receive: ${marketGold} MG\n\nDeliver in-game to this buyer:\n` +
    `  Name: ${buyer.name}\n  Email: ${buyer.email}\n  In-game name: ${buyerInGameName}\n\n` +
    `Once delivered, open SwitchBored and mark the trade delivered to release your Market Gold.`;
  return send(seller.email, `SwitchBored: your "${productName}" sold`, body);
}

export function notifyBuyerOfCompletion({ buyer, gameName, productName, marketGold }) {
  const body =
    `Your trade is done!\n\nGame: ${gameName}\nItem: ${productName}\nPaid: ${marketGold} MG\n\n` +
    `The seller marked your item delivered. Happy trading.`;
  return send(buyer.email, `SwitchBored: your trade is complete`, body);
}
