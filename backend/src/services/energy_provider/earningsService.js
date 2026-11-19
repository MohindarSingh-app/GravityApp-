/**
 * Earnings service - what a partner has earned and what is still pending.
 *
 * Every completed job writes an `earnings` row containing the gross amount,
 * the platform commission and the net payout, so the figures on the earnings
 * screen are always derived from the same source as the job history.
 */

const { EarningsModel } = require('../../models/energy_provider/MarketplaceModels');
const { ApiError } = require('../../utils/energy_provider/apiError');

const EarningsService = {
  /** Every earnings row for the partner, newest first. */
  async listEarnings(user, { status } = {}) {
    const rows = await EarningsModel.findByPartner(user.id);
    const filtered = status ? rows.filter((row) => row.status === status) : rows;
    return filtered.map((row) => EarningsModel.toApi(row));
  },

  /** Totals broken down by status plus an all-time summary. */
  async getSummary(user) {
    const rows = await EarningsModel.findByPartner(user.id);

    const sum = (list, key) => list.reduce((total, row) => total + Number(row[key] || 0), 0);

    const pending = rows.filter((row) => row.status === 'pending');
    const paid = rows.filter((row) => row.status === 'paid');
    const failed = rows.filter((row) => row.status === 'failed');

    return {
      totalGross: Math.round(sum(rows, 'gross_amount') * 100) / 100,
      totalCommission: Math.round(sum(rows, 'commission') * 100) / 100,
      totalNet: Math.round(sum(rows, 'net_amount') * 100) / 100,
      pendingAmount: Math.round(sum(pending, 'net_amount') * 100) / 100,
      paidAmount: Math.round(sum(paid, 'net_amount') * 100) / 100,
      failedAmount: Math.round(sum(failed, 'net_amount') * 100) / 100,
      counts: {
        total: rows.length,
        pending: pending.length,
        paid: paid.length,
        failed: failed.length,
      },
      bySource: rows.reduce((acc, row) => {
        const source = row.source || 'service';
        acc[source] = Math.round((acc[source] || 0) + Number(row.net_amount || 0) * 100) / 100;
        return acc;
      }, {}),
    };
  },

  /** A single earnings row. */
  async getEarning(user, earningId) {
    const rows = await EarningsModel.findByPartner(user.id);
    const row = rows.find((entry) => String(entry.id) === String(earningId));
    if (!row) throw ApiError.notFound('Earning not found');
    return EarningsModel.toApi(row);
  },

  /**
   * Mark an earning as paid.  Only a pending row can be paid, and the payout
   * date is stamped automatically.
   */
  async markPaid(user, earningId, { bankReference } = {}) {
    const rows = await EarningsModel.findByPartner(user.id);
    const row = rows.find((entry) => String(entry.id) === String(earningId));
    if (!row) throw ApiError.notFound('Earning not found');
    if (row.status === 'paid') {
      throw ApiError.conflict('This earning has already been paid');
    }

    const updated = await EarningsModel.updateById(earningId, {
      status: 'paid',
      payoutDate: new Date().toISOString(),
      bankReference: bankReference || row.bank_reference || '',
    });

    return EarningsModel.toApi(updated);
  },
};

module.exports = EarningsService;
