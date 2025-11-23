import DailyProfit from "../models/DailyProfit.js";
import InvestorRequest from "../models/InvestorRequest.js";
import User from "../models/User.js";

/**
 * Calculate variable daily profit amount while ensuring monthly target is met
 * @param {number} monthlyTarget - Total monthly profit to distribute
 * @param {number} currentDay - Current day of month (1-31)
 * @param {number} daysInMonth - Total days in the month
 * @param {number} earnedSoFar - Amount already distributed this month
 * @returns {number} Daily profit amount
 */
function calculateDailyProfit(
  monthlyTarget,
  currentDay,
  daysInMonth,
  earnedSoFar
) {
  const remaining = monthlyTarget - earnedSoFar;
  const daysLeft = daysInMonth - currentDay + 1;

  // On last day, give exact remaining amount
  if (daysLeft === 1) {
    return Math.max(0, remaining);
  }

  const avgPerDay = remaining / daysLeft;

  // Vary by ±30% of average to create variability
  const variation = avgPerDay * 0.3;
  const min = Math.max(0, avgPerDay - variation);
  const max = avgPerDay + variation;

  // Random amount between min and max
  const dailyAmount = min + Math.random() * (max - min);

  // Round to 2 decimal places
  return Math.round(dailyAmount * 100) / 100;
}

/**
 * Get current month-year string
 * @param {Date} date
 * @returns {string} Format: "YYYY-MM"
 */
function getMonthYear(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get number of days in a month
 * @param {Date} date
 * @returns {number}
 */
function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Distribute daily profits for all active investor requests
 * Should be run once per day via cron job
 */
export async function distributeDailyProfits() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStr = today.toISOString().split("T")[0];
    const monthYear = getMonthYear(today);
    const currentDay = today.getDate();
    const daysInMonth = getDaysInMonth(today);

    console.log(`[DailyProfit] Running distribution for ${todayStr}`);

    // Find all accepted investor requests with profit distribution
    const activeRequests = await InvestorRequest.find({
      status: "accepted",
      monthlyProfitPercentage: { $gt: 0 },
      approvedProfitAmount: { $gt: 0 },
      profitDistributionStartDate: { $lte: today },
    }).populate("investor", "firstName lastName email");

    console.log(`[DailyProfit] Found ${activeRequests.length} active requests`);

    let distributed = 0;
    let skipped = 0;

    for (const request of activeRequests) {
      try {
        // Check if already distributed today
        const existingToday = await DailyProfit.findOne({
          investorRequest: request._id,
          date: today,
        });

        if (existingToday) {
          skipped++;
          continue;
        }

        // Get total earned this month
        const monthProfits = await DailyProfit.find({
          investorRequest: request._id,
          monthYear,
        });

        const earnedThisMonth = monthProfits.reduce(
          (sum, p) => sum + p.amount,
          0
        );

        // Calculate today's amount
        const dailyAmount = calculateDailyProfit(
          request.approvedProfitAmount,
          currentDay,
          daysInMonth,
          earnedThisMonth
        );

        if (dailyAmount <= 0) {
          skipped++;
          continue;
        }

        // Create daily profit record
        await DailyProfit.create({
          investor: request.investor._id,
          investorRequest: request._id,
          date: today,
          amount: dailyAmount,
          currency: request.currency,
          monthYear,
          isManual: false,
        });

        // Update last distribution date
        request.lastDistributionDate = today;
        await request.save();

        // Update investor's earned profit
        await User.updateOne(
          { _id: request.investor._id },
          { $inc: { "investorProfile.earnedProfit": dailyAmount } }
        );

        distributed++;
        console.log(
          `[DailyProfit] Distributed ${dailyAmount} ${request.currency} to investor ${request.investor.email}`
        );
      } catch (err) {
        console.error(
          `[DailyProfit] Error distributing for request ${request._id}:`,
          err
        );
      }
    }

    console.log(
      `[DailyProfit] Distribution complete: ${distributed} distributed, ${skipped} skipped`
    );
    return { distributed, skipped, total: activeRequests.length };
  } catch (error) {
    console.error("[DailyProfit] Distribution failed:", error);
    throw error;
  }
}

/**
 * Get daily profit history for an investor
 * @param {string} investorId
 * @param {string} monthYear - Optional, defaults to current month
 * @returns {Promise<Array>}
 */
export async function getInvestorDailyProfits(investorId, monthYear = null) {
  const targetMonth = monthYear || getMonthYear(new Date());

  const profits = await DailyProfit.find({
    investor: investorId,
    monthYear: targetMonth,
  }).sort({ date: 1 });

  return profits;
}

/**
 * Get monthly profit summary for an investor
 * @param {string} investorId
 * @param {string} monthYear - Optional, defaults to current month
 * @returns {Promise<Object>}
 */
export async function getMonthlyProfitSummary(investorId, monthYear = null) {
  const targetMonth = monthYear || getMonthYear(new Date());

  const profits = await DailyProfit.find({
    investor: investorId,
    monthYear: targetMonth,
  });

  const requests = await InvestorRequest.find({
    investor: investorId,
    status: "accepted",
    monthlyProfitPercentage: { $gt: 0 },
  });

  const totalEarned = profits.reduce((sum, p) => sum + p.amount, 0);
  const totalTarget = requests.reduce(
    (sum, r) => sum + (r.approvedProfitAmount || 0),
    0
  );
  const currency = requests[0]?.currency || "AED";

  return {
    monthYear: targetMonth,
    totalEarned,
    totalTarget,
    currency,
    dailyProfits: profits.length,
    percentComplete: totalTarget > 0 ? (totalEarned / totalTarget) * 100 : 0,
  };
}
