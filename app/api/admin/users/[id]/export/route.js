import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Account from '@/lib/models/Account';
import Post from '@/lib/models/Post';
import Template from '@/lib/models/Template';
import Subscription from '@/lib/models/Subscription';
import UserActivity from '@/lib/models/UserActivity';
import Payment from '@/lib/models/Payment';

// GET /api/admin/users/:id/export — download single user data as JSON
export async function GET(request, { params }) {
  try {
    const session = await getAdminSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: ownerId } = await params;
    await connectDB();

    const [accounts, posts, templates, subscription, activities, payments] = await Promise.all([
      Account.find({ ownerId }).select('-accessToken').lean(),
      Post.find({ ownerId }).lean(),
      Template.find({ ownerId }).lean(),
      Subscription.findOne({ ownerId }).populate('plan').lean(),
      UserActivity.find({ ownerId }).sort({ createdAt: -1 }).limit(500).lean(),
      Payment.find({ ownerId }).sort({ createdAt: -1 }).lean(),
    ]);

    const displayName = accounts[0]?.displayName || ownerId;

    const backup = {
      exportedAt: new Date().toISOString(),
      user: {
        ownerId,
        displayName,
        email: accounts[0]?.email || null,
      },
      stats: {
        accounts: accounts.length,
        posts: posts.length,
        templates: templates.length,
        activities: activities.length,
        payments: payments.length,
      },
      subscription: subscription || null,
      data: { accounts, posts, templates, activities, payments },
    };

    const json = JSON.stringify(backup, null, 2);
    const safeName = displayName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);

    return new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="user-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error('[ADMIN USER EXPORT]', error);
    return Response.json({ error: 'Export failed' }, { status: 500 });
  }
}
