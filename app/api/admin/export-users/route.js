import ExcelJS from 'exceljs';
import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Account from '@/lib/models/Account';
import Post from '@/lib/models/Post';
import Subscription from '@/lib/models/Subscription';
import UserActivity from '@/lib/models/UserActivity';

// GET /api/admin/export-users — download all users data as Excel
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const accounts = await Account.find({}).select('-accessToken').lean();
    const ownerIds = [...new Set(accounts.map((a) => a.ownerId).filter(Boolean))];

    const [postStats, activityStats, subscriptions] = await Promise.all([
      Post.aggregate([
        { $match: { ownerId: { $in: ownerIds } } },
        { $group: {
          _id: '$ownerId',
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', 'PUBLISHED'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
          drafts: { $sum: { $cond: [{ $eq: ['$status', 'DRAFT'] }, 1, 0] } },
        }},
      ]),
      UserActivity.aggregate([
        { $match: { ownerId: { $in: ownerIds } } },
        { $group: {
          _id: '$ownerId',
          logins: { $sum: { $cond: [{ $eq: ['$action', 'login'] }, 1, 0] } },
          lastActive: { $max: '$createdAt' },
          lastCity: { $last: '$city' },
          lastCountry: { $last: '$country' },
          lastDevice: { $last: '$device' },
          lastBrowser: { $last: '$browser' },
        }},
      ]),
      Subscription.find({ ownerId: { $in: ownerIds } }).populate('plan', 'name').lean(),
    ]);

    const postMap = {};
    for (const s of postStats) postMap[s._id] = s;
    const actMap = {};
    for (const a of activityStats) actMap[a._id] = a;
    const subMap = {};
    for (const s of subscriptions) subMap[s.ownerId] = s;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'LinkedIn URN', key: 'urn', width: 28 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Plan', key: 'plan', width: 12 },
      { header: 'Total Posts', key: 'total', width: 12 },
      { header: 'Published', key: 'published', width: 12 },
      { header: 'Pending', key: 'pending', width: 10 },
      { header: 'Failed', key: 'failed', width: 10 },
      { header: 'Drafts', key: 'drafts', width: 10 },
      { header: 'Logins', key: 'logins', width: 10 },
      { header: 'Last Active', key: 'lastActive', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Device', key: 'device', width: 12 },
      { header: 'Browser', key: 'browser', width: 12 },
      { header: 'Token Expires', key: 'tokenExpires', width: 20 },
      { header: 'Connected', key: 'connected', width: 16 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const ownerId of ownerIds) {
      const acc = accounts.find((a) => a.ownerId === ownerId);
      const ps = postMap[ownerId] || {};
      const act = actMap[ownerId] || {};
      const sub = subMap[ownerId];

      sheet.addRow({
        name: acc?.displayName || 'Unknown',
        email: acc?.email || '',
        urn: acc?.authorUrn || '',
        status: acc?.status || 'ACTIVE',
        plan: sub?.plan?.name || 'Free',
        total: ps.total || 0,
        published: ps.published || 0,
        pending: ps.pending || 0,
        failed: ps.failed || 0,
        drafts: ps.drafts || 0,
        logins: act.logins || 0,
        lastActive: act.lastActive ? new Date(act.lastActive).toISOString() : '',
        location: [act.lastCity, act.lastCountry].filter(Boolean).join(', ') || '',
        device: act.lastDevice || '',
        browser: act.lastBrowser || '',
        tokenExpires: acc?.tokenExpiresAt ? new Date(acc.tokenExpiresAt).toISOString() : '',
        connected: acc?.createdAt ? new Date(acc.createdAt).toISOString() : '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[ADMIN EXPORT USERS]', error);
    return Response.json({ error: 'Export failed' }, { status: 500 });
  }
}
