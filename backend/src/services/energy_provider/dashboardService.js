/**
 * Dashboard service - the summary shown on each partner home screen.
 *
 * The figures are computed from the same tables the marketplace uses, so the
 * dashboard can never drift from the job and earnings history.
 */

const UserModel = require('../../models/energy_provider/UserModel');
const JobModel = require('../../models/energy_provider/JobModel');
const JobService = require('./jobCoreService');
const { EarningsModel, NotificationModel } = require('../../models/energy_provider/MarketplaceModels');

const DashboardService = {
  /** The partner's own dashboard. */
  async getDashboard(user) {
    const profile = await UserModel.findById(user.id);

    const active = await JobModel.findActiveForPartner(user.id);
    const completed = await JobModel.findCompletedForPartner(user.id);
    const earnings = await EarningsModel.findByPartner(user.id);
    const notifications = await NotificationModel.findByPartner(user.id);

    const sum = (key) =>
      Math.round(earnings.reduce((total, row) => total + Number(row[key] || 0), 0) * 100) / 100;
    const activeJobs = await Promise.all(active.map((job) => JobService.toPartnerJobApi(job)));

    return {
      role: user.role,
      profile: {
        id: user.id,
        name: user.full_name,
        businessName: user.business_name,
        rating: profile ? profile.rating : 0,
        jobsCompleted: profile ? profile.jobs_completed : 0,
        isOnline: !!user.is_online,
        isBusy: !!user.is_busy,
        partnerSince: profile ? profile.partner_since : null,
      },
      stats: {
        totalJobs: active.length + completed.length,
        activeJobs: active.length,
        completedJobs: completed.length,
        totalEarnings: sum('net_amount'),
        pendingEarnings: Math.round(
          earnings
            .filter((row) => row.status === 'pending')
            .reduce((total, row) => total + Number(row.net_amount || 0), 0) * 100
        ) / 100,
        rating: profile ? profile.rating : 0,
        unreadNotifications: notifications.filter((note) => !note.is_read).length,
      },
      activeJobs,
      recentNotifications: notifications.slice(0, 5).map((note) => ({
        id: note.id,
        type: note.type,
        title: note.title,
        body: note.body,
        isRead: !!note.is_read,
        createdAt: note.created_at,
      })),
    };
  },

  /** Notifications for the partner, newest first. */
  async listNotifications(user) {
    const notifications = await NotificationModel.findByPartner(user.id);
    return notifications.map((note) => ({
      id: note.id,
      jobId: note.job_id,
      type: note.type,
      title: note.title,
      body: note.body,
      isRead: !!note.is_read,
      createdAt: note.created_at,
    }));
  },

  /** Mark a single notification as read. */
  async markNotificationRead(user, notificationId) {
    const notifications = await NotificationModel.findByPartner(user.id);
    const found = notifications.find((note) => String(note.id) === String(notificationId));
    if (!found) return { id: notificationId, isRead: true };
    const updated = await NotificationModel.markRead(notificationId);
    return { id: updated.id, isRead: !!updated.is_read };
  },
};

module.exports = DashboardService;
