// auth.js — password hashing (bcrypt) + JWT sessions.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as db from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (SECRET === 'dev-secret-change-me') console.warn('⚠ Using the default JWT secret. Set JWT_SECRET in .env for anything real.');

export const hashPassword = (pw) => bcrypt.hashSync(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compareSync(pw, hash);
export const signToken = (userId) => jwt.sign({ uid: userId }, SECRET, { expiresIn: '30d' });

// Public-safe view of a user (never leak the hash)
export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, marketGold: u.market_gold });

// Express middleware: requires a valid Bearer token, attaches req.user
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please sign in again.' });
  try {
    const { uid } = jwt.verify(token, SECRET);
    const user = db.getUserById(uid);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Please sign in again.' });
  }
}
