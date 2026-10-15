import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
import axios from 'axios';
import { connectDB } from '../lib/db.js';
import Account from '../lib/models/Account.js';
import Post from '../lib/models/Post.js';
import { getRows, getSheet, parseSheetDateTime, setCell, setOutcome, sheetConfigured } from '../lib/sheetBridge.js';
import { uploadImageAsset } from '../lib/linkedinService.js';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, isObjectId } from '../lib/api.js';

function publicIp(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIP(address) === 6) {
    const lower = address.toLowerCase();
    return !(lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb') || lower.startsWith('::ffff:'));
  }
  return false;
}

export async function downloadImage(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) throw new Error('Image URL must be public HTTPS');

  // Simple fetch without DNS pinning (DNS pinning fails on Vercel serverless)
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20_000,
    maxRedirects: 3,
    maxContentLength: MAX_IMAGE_BYTES,
    validateStatus: (status) => status === 200,
    proxy: false,
  });
  const type = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(type) || response.data.length > MAX_IMAGE_BYTES) {
    throw new Error('Image must be JPEG, PNG, or GIF and no larger than 10 MB');
  }
  return { buffer: response.data, type };
}

async function getAccount() {
  const selected = process.env.GOOGLE_SHEET_ACCOUNT_ID;
  if (selected) {
    if (!isObjectId(selected)) {
      throw new Error('GOOGLE_SHEET_ACCOUNT_ID must be a 24-character app Account ID; remove it when using one account');
    }
    const account = await Account.findById(selected).select('+accessToken');
    if (!account) throw new Error('Configured LinkedIn account was not found');
    return account;
  }
  const accounts = await Account.find().limit(2).select('+accessToken');
  if (accounts.length !== 1) throw new Error('Connect exactly one LinkedIn account or set GOOGLE_SHEET_ACCOUNT_ID');
  return accounts[0];
}

function outcome(post, timeZone) {
  if (post.status === 'PUBLISHED') {
    const date = post.publishedAt || post.updatedAt;
    const postedAt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date).replace(',', '');
    return ['Posted', postedAt, ''];
  }
  if (post.status === 'FAILED') return ['Error', '', post.errorMessage || 'LinkedIn publishing failed'];
  if (post.status === 'DRAFT') return ['Error', '', post.errorMessage || 'Sheet row needs correction'];
  if (post.status === 'PROCESSING') return ['Posting', '', ''];
  return ['Scheduled', '', ''];
}

let activeSync = null;

export function syncSheet() {
  if (activeSync) return activeSync;
  activeSync = runSyncSheet().finally(() => { activeSync = null; });
  return activeSync;
}

async function runSyncSheet() {
  if (!sheetConfigured()) return;
  await connectDB();
  const sheet = await getSheet();
  const rows = await getRows(sheet);
  const header = rows[0] || [];
  if (!String(header[0] || '').includes('Post Text') || !String(header[2] || '').includes('Scheduled Date')) {
    throw new Error('Google Sheet columns A:G do not match the expected template');
  }
  if (!header[7]) await setCell(sheet, 'H1', 'Automation ID (do not edit)');

  let account;
  const seenKeys = new Set();
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;
    const [commentaryRaw, imageUrl, date, time, statusRaw, , , existingKey] = row;
    const commentary = String(commentaryRaw || '').trim();
    if (!commentary) continue;
    const status = String(statusRaw || '').trim().toLowerCase();
    const key = String(existingKey || '').trim();
    const sourceImageUrl = String(imageUrl || '').trim();
    if (key) {
      if (seenKeys.has(key)) {
        await setOutcome(sheet, rowNumber, 'Error', '', 'Duplicate Automation ID in column H');
        continue;
      }
      seenKeys.add(key);
      const post = await Post.findOne({ 'sheetSource.key': key });
      if (post) {
        if (post.sheetSource.spreadsheetId !== sheet.spreadsheetId || post.sheetSource.sheetId !== sheet.gid) {
          await setOutcome(sheet, rowNumber, 'Error', '', 'Automation ID belongs to another sheet');
          continue;
        }
        if ((post.status === 'PENDING' && ['scheduled', 'pending'].includes(status)) ||
            (post.status === 'DRAFT' && status === 'pending')) {
          const scheduledAt = parseSheetDateTime(date, time, sheet.timeZone);
          if (!commentary || commentary.length > 5000 || !scheduledAt) {
            await Post.updateOne({ _id: post._id, status: 'PENDING' },
              { $set: { status: 'DRAFT', errorMessage: 'Sheet row requires valid text, date and time' } });
            await setOutcome(sheet, rowNumber, 'Error', '', 'Use 1-5000 characters, YYYY-MM-DD and HH:mm');
            continue;
          }
          const changed = post.commentary !== commentary ||
            post.scheduledAt?.getTime() !== scheduledAt.getTime() ||
            (post.sheetSource.imageUrl || '') !== sourceImageUrl || post.status === 'DRAFT';
          if (changed) {
            const claimed = await Post.findOneAndUpdate(
              { _id: post._id, status: post.status },
              { $set: { status: 'DRAFT' } },
              { new: true }
            );
            if (!claimed) continue;
            try {
              const postAccount = await Account.findById(post.account).select('+accessToken');
              if (!postAccount || postAccount.tokenExpiresAt <= new Date()) {
                throw new Error('LinkedIn access token expired or account missing; reconnect the account');
              }
              let mediaUrl = post.mediaUrl;
              if ((post.sheetSource.imageUrl || '') !== sourceImageUrl) {
                mediaUrl = null;
                if (sourceImageUrl) {
                  const image = await downloadImage(sourceImageUrl);
                  mediaUrl = await uploadImageAsset(postAccount.accessToken, postAccount.authorUrn, image.buffer, image.type);
                }
              }
              claimed.commentary = commentary;
              claimed.scheduledAt = scheduledAt;
              claimed.mediaUrl = mediaUrl;
              claimed.sheetSource.imageUrl = sourceImageUrl || null;
              claimed.errorMessage = null;
              claimed.status = 'PENDING';
              await claimed.save();
            } catch (error) {
              console.error(`Sheet row ${rowNumber} update failed:`, error);
              await setOutcome(sheet, rowNumber, 'Error', '', 'Unable to update scheduled post; correct the row and set Pending');
              continue;
            }
          }
        }
        const current = await Post.findById(post._id);
        if (!current) continue;
        const [nextStatus, postedAt, error] = outcome(current, sheet.timeZone);
        if (String(statusRaw || '') !== nextStatus || String(row[5] || '') !== postedAt || String(row[6] || '') !== error) {
          await setOutcome(sheet, rowNumber, nextStatus, postedAt, error);
        }
        continue;
      }
    }
    if (status && status !== 'pending' && !(status === 'scheduled' && key)) continue;
    try {
      if (commentary.length > 5000) throw new Error('Post text must be 1 to 5000 characters');
      const scheduledAt = parseSheetDateTime(date, time, sheet.timeZone);
      if (!scheduledAt) throw new Error('Use YYYY-MM-DD in column C and HH:mm in column D');
      account ||= await getAccount();
      if (account.tokenExpiresAt <= new Date()) throw new Error('LinkedIn access token expired; reconnect the account');
      const postKey = key || crypto.randomUUID();
      if (!key) await setCell(sheet, `H${rowNumber}`, postKey);
      let mediaUrl = null;
      if (sourceImageUrl) {
        const image = await downloadImage(sourceImageUrl);
        mediaUrl = await uploadImageAsset(account.accessToken, account.authorUrn, image.buffer, image.type);
      }
      await Post.create({ account: account._id, commentary, mediaUrl, scheduledAt,
        status: 'PENDING', sheetSource: { key: postKey, spreadsheetId: sheet.spreadsheetId, sheetId: sheet.gid, imageUrl: sourceImageUrl || null } });
      await setOutcome(sheet, rowNumber, 'Scheduled');
    } catch (error) {
      if (error.code === 11000) continue;
      console.error(`Sheet row ${rowNumber} import failed:`, error);
      await setOutcome(sheet, rowNumber, 'Error', '', error.message.startsWith('Google') ? 'Google Sheets or image access failed' : error.message.slice(0, 250));
    }
  }
}
