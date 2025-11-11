import User from '../models/User.js';
import Order from '../models/Order.js';

/**
 * Assigns investor profit to an order when it's delivered
 * Uses sequential assignment: finds first active investor who hasn't reached target
 * @param {Object} order - The order object
 * @param {String} ownerId - The owner/company ID
 * @returns {Promise<Object>} - Result object with investor and profit details
 */
export async function assignInvestorProfitToOrder(order, ownerId) {
  try {
    // Check if order already has investor profit assigned
    if (order.investorProfit?.investor) {
      return {
        success: false,
        message: 'Investor profit already assigned to this order'
      };
    }

    // Find all active investors for this owner, sorted by creation date (sequence)
    const investors = await User.find({
      createdBy: ownerId,
      role: 'investor',
      'investorProfile.status': 'active'
    }).sort({ createdAt: 1 }).lean(); // Oldest first (sequence)

    if (investors.length === 0) {
      return {
        success: false,
        message: 'No active investors found'
      };
    }

    // Find first investor who hasn't reached target profit
    let selectedInvestor = null;
    for (const inv of investors) {
      const profile = inv.investorProfile || {};
      const earnedProfit = profile.earnedProfit || 0;
      const targetProfit = profile.targetProfit || 0;

      if (earnedProfit < targetProfit) {
        selectedInvestor = inv;
        break;
      }
    }

    if (!selectedInvestor) {
      return {
        success: false,
        message: 'All investors have reached their target profit'
      };
    }

    // Calculate profit for this order
    const orderTotal = order.total || 0;
    const profitPercentage = selectedInvestor.investorProfile?.profitPercentage || 15;
    const profitAmount = (orderTotal * profitPercentage) / 100;

    // Update order with investor profit
    order.investorProfit = {
      investor: selectedInvestor._id,
      profitAmount: profitAmount,
      assignedAt: new Date()
    };
    await order.save();

    // Update investor's earned profit
    const updatedInvestor = await User.findById(selectedInvestor._id);
    if (updatedInvestor) {
      updatedInvestor.investorProfile.earnedProfit += profitAmount;
      updatedInvestor.investorProfile.totalReturn = 
        (updatedInvestor.investorProfile.investmentAmount || 0) + 
        updatedInvestor.investorProfile.earnedProfit;

      // Check if investor reached target profit
      if (updatedInvestor.investorProfile.earnedProfit >= updatedInvestor.investorProfile.targetProfit) {
        updatedInvestor.investorProfile.status = 'completed';
        updatedInvestor.investorProfile.completedAt = new Date();
      }

      await updatedInvestor.save();
    }

    return {
      success: true,
      investor: {
        id: selectedInvestor._id,
        name: `${selectedInvestor.firstName} ${selectedInvestor.lastName}`.trim()
      },
      profitAmount,
      message: 'Investor profit assigned successfully'
    };
  } catch (error) {
    console.error('Error assigning investor profit:', error);
    return {
      success: false,
      message: error.message || 'Failed to assign investor profit'
    };
  }
}

/**
 * Get next investor in sequence for profit assignment
 * @param {String} ownerId - The owner/company ID
 * @returns {Promise<Object|null>} - Next investor or null
 */
export async function getNextInvestorInSequence(ownerId) {
  try {
    const investors = await User.find({
      createdBy: ownerId,
      role: 'investor',
      'investorProfile.status': 'active'
    }).sort({ createdAt: 1 }).lean();

    for (const inv of investors) {
      const profile = inv.investorProfile || {};
      const earnedProfit = profile.earnedProfit || 0;
      const targetProfit = profile.targetProfit || 0;

      if (earnedProfit < targetProfit) {
        return {
          id: inv._id,
          name: `${inv.firstName} ${inv.lastName}`.trim(),
          email: inv.email,
          investmentAmount: profile.investmentAmount,
          profitPercentage: profile.profitPercentage,
          targetProfit: profile.targetProfit,
          earnedProfit: profile.earnedProfit,
          remaining: targetProfit - earnedProfit
        };
      }
    }

    return null; // No active investor found
  } catch (error) {
    console.error('Error getting next investor:', error);
    return null;
  }
}

/**
 * Remove investor profit from an order (e.g., when order is cancelled after delivery)
 * @param {Object} order - The order object
 * @returns {Promise<Boolean>} - Success status
 */
export async function removeInvestorProfitFromOrder(order) {
  try {
    if (!order.investorProfit?.investor) {
      return true; // Nothing to remove
    }

    const investorId = order.investorProfit.investor;
    const profitAmount = order.investorProfit.profitAmount || 0;

    // Update investor's earned profit (subtract)
    const investor = await User.findById(investorId);
    if (investor && investor.investorProfile) {
      investor.investorProfile.earnedProfit = Math.max(0, 
        (investor.investorProfile.earnedProfit || 0) - profitAmount
      );
      investor.investorProfile.totalReturn = 
        (investor.investorProfile.investmentAmount || 0) + 
        investor.investorProfile.earnedProfit;

      // If was completed, revert to active
      if (investor.investorProfile.status === 'completed' && 
          investor.investorProfile.earnedProfit < investor.investorProfile.targetProfit) {
        investor.investorProfile.status = 'active';
        investor.investorProfile.completedAt = null;
      }

      await investor.save();
    }

    // Clear investor profit from order
    order.investorProfit = {};
    await order.save();

    return true;
  } catch (error) {
    console.error('Error removing investor profit:', error);
    return false;
  }
}
