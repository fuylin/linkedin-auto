import { parseSheetDateTime } from './sheetBridge.js';

const normalize = (value) => String(value || '').toLowerCase().replace(/^[a-h]:\s*/, '').replace(/[^a-z0-9]/g, '');

function dateText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const serialDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    if (!Number.isNaN(serialDate.getTime())) return serialDate.toISOString().slice(0, 10);
  }
  return String(value || '').trim();
}

function timeText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') {
    const minutes = Math.round((value % 1) * 1440) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  return String(value || '').trim();
}

export function parseUploadRows(matrix, timeZone, now = new Date()) {
  if (!Array.isArray(matrix) || matrix.length < 2) throw new Error('The file needs a header row and at least one post.');
  const headers = matrix[0].map(normalize);
  const column = (...names) => headers.findIndex((header) => names.includes(header));
  const textColumn = column('posttext', 'commentary');
  const imageColumn = column('imageurloptional', 'imageurl');
  const dateColumn = column('scheduleddate');
  const timeColumn = column('scheduledtime');
  const statusColumn = column('status');
  const postedAtColumn = column('postedat');
  const idColumn = column('automationiddonotedit', 'automationid');
  if (textColumn < 0 || dateColumn < 0 || timeColumn < 0) {
    throw new Error('Required columns: Post Text, Scheduled Date, Scheduled Time. Use the Google Sheet header row.');
  }

  const posts = [];
  const errors = [];
  let skipped = 0;
  for (let index = 1; index < matrix.length; index += 1) {
    const row = matrix[index] || [];
    const rowNumber = index + 1;
    if (row.every((value) => value === '' || value === null || value === undefined)) continue;
    const commentary = String(row[textColumn] || '').trim();
    const status = statusColumn < 0 ? '' : String(row[statusColumn] || '').trim().toLowerCase();
    if (status && status !== 'pending') { skipped += 1; continue; }
    if (postedAtColumn >= 0 && String(row[postedAtColumn] || '').trim()) { skipped += 1; continue; }
    if (idColumn >= 0 && String(row[idColumn] || '').trim()) { skipped += 1; continue; }
    if (!commentary || commentary.length > 5000) {
      errors.push(`Row ${rowNumber}: Post Text must be 1–5000 characters.`);
      skipped += 1;
      continue;
    }
    const date = dateText(row[dateColumn]);
    const time = timeText(row[timeColumn]);
    const scheduledAt = parseSheetDateTime(date, time, timeZone);
    if (!scheduledAt) {
      errors.push(`Row ${rowNumber}: Use a valid Scheduled Date (YYYY-MM-DD) and Scheduled Time (HH:mm).`);
      skipped += 1;
      continue;
    }
    if (scheduledAt <= now) {
      errors.push(`Row ${rowNumber}: Scheduled Date/Time must be in the future.`);
      skipped += 1;
      continue;
    }
    const imageUrl = imageColumn < 0 ? '' : String(row[imageColumn] || '').trim();
    if (imageUrl) {
      try {
        const parsed = new URL(imageUrl);
        if (parsed.protocol !== 'https:') throw new Error('HTTPS required');
      } catch {
        errors.push(`Row ${rowNumber}: Image URL must be a public HTTPS URL.`);
        skipped += 1;
        continue;
      }
    }
    posts.push({ rowNumber, commentary, imageUrl, scheduledAt });
  }
  return { posts, skipped, errors };
}
