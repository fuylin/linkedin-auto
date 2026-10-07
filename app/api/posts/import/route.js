import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { connectDB } from '@/lib/db';
import { isObjectId } from '@/lib/api';
import { parseUploadRows } from '@/lib/postImport';
import { downloadImage } from '@/workers/sheetSync';
import { uploadImageAsset } from '@/lib/linkedinService';
import Account from '@/lib/models/Account';
import Post from '@/lib/models/Post';
import { getOwnerId, unauthorized } from '@/lib/currentUser';
import { trackActivity } from '@/lib/activity';
import { checkLimit } from '@/lib/limits';

export const runtime = 'nodejs';
export const maxDuration = 60;

function cellValue(value) {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('result' in value) return value.result ?? '';
    if ('text' in value) return value.text ?? '';
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
    return '';
  }
  return value ?? '';
}

export async function POST(request) {
  const ownerId = await getOwnerId(request);
  if (!ownerId) return unauthorized();
  const limit = await checkLimit(ownerId, 'access_import');
  if (!limit.allowed) return Response.json({ error: limit.reason, upgrade: limit.upgrade }, { status: 403 });

  try {
    const form = await request.formData();
    const file = form.get('file');
    const accountId = form.get('accountId');
    const timeZone = String(form.get('timeZone') || '').trim();
    if (!(file instanceof File) || !isObjectId(accountId)) {
      return Response.json({ error: 'Select a file and a LinkedIn account.' }, { status: 400 });
    }
    if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
      return Response.json({ error: 'Upload a CSV or XLSX file no larger than 2 MB. Save old XLS files as XLSX first.' }, { status: 400 });
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone });
    } catch {
      return Response.json({ error: 'Choose a valid IANA time zone.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    const firstSheet = /\.csv$/i.test(file.name)
      ? await workbook.csv.read(Readable.from([buffer]), { map: (value) => value })
      : (await workbook.xlsx.load(buffer)).worksheets[0];
    if (!firstSheet) return Response.json({ error: 'The file contains no worksheet.' }, { status: 400 });
    if (firstSheet.rowCount > 101 || firstSheet.columnCount > 32) {
      return Response.json({ error: 'Import at most 100 rows and 32 columns per file.' }, { status: 400 });
    }
    const matrix = [];
    for (let index = 1; index <= firstSheet.rowCount; index += 1) {
      const row = firstSheet.getRow(index);
      matrix.push(Array.from({ length: firstSheet.columnCount }, (_, col) => cellValue(row.getCell(col + 1).value)));
    }
    const { posts, skipped, errors } = parseUploadRows(matrix, timeZone);

    await connectDB();
    const account = await Account.findOne({ _id: accountId, ownerId }).select('+accessToken');
    if (!account) return Response.json({ error: 'LinkedIn account not found.' }, { status: 404 });
    if (account.tokenExpiresAt <= new Date()) {
      return Response.json({ error: 'LinkedIn access expired. Reconnect the account before importing.' }, { status: 401 });
    }

    const result = { imported: 0, skipped, errors };
    for (const item of posts) {
      try {
        const importKey = crypto.createHash('sha256')
          .update(JSON.stringify([ownerId, String(account._id), item.commentary, item.imageUrl, item.scheduledAt.toISOString()]))
          .digest('hex');
        if (await Post.exists({ 'importSource.key': importKey })) {
          result.skipped += 1;
          continue;
        }
        let mediaUrl = null;
        if (item.imageUrl) {
          const image = await downloadImage(item.imageUrl);
          mediaUrl = await uploadImageAsset(account.accessToken, account.authorUrn, image.buffer, image.type);
        }
        await Post.create({
          ownerId,
          account: account._id,
          commentary: item.commentary,
          mediaUrl,
          scheduledAt: item.scheduledAt,
          status: 'PENDING',
          importSource: { key: importKey },
        });
        result.imported += 1;
      } catch (error) {
        if (error.code === 11000) {
          result.skipped += 1;
          continue;
        }
        console.error(`[FILE IMPORT ROW ${item.rowNumber}]`, error);
        result.errors.push(`Row ${item.rowNumber}: Import failed; check the image URL or LinkedIn connection.`);
        result.skipped += 1;
      }
    }
    if (result.imported > 0) trackActivity({ ownerId, action: 'post_imported', request, metadata: { imported: result.imported, skipped: result.skipped } }).catch(() => {});
    return Response.json(result);
  } catch (error) {
    console.error('[FILE IMPORT ERROR]', error);
    return Response.json({ error: 'Could not read the file. Check its format and headers.' }, { status: 400 });
  }
}
