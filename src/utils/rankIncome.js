const generateRandomString = require("../config/generateRandomId");
const { rankRewardAmount } = require("../constants/topup.constants");
const User = require("../models/auth.model");
const { RankIncome } = require("../models/rankIncome.model");
const { PackageRoi } = require("../models/topup.model");
const cron = require("node-cron");
const Wallet = require("../models/wallet.model");
const getIstTime = require("../config/getTime");

const getUserDirectActiveCount = async (userId) => {
  try {
    return User.countDocuments({
      sponsorId: userId,
      isActive: true,
    });
  } catch (error) {
    console.log("direct user", error);
  }
};

const getTotalPackageRoi = async (matchQuery) => {
  try {
    const [result] = await PackageRoi.aggregate([
      {
        $match: matchQuery,
      },
      {
        $project: {
          userId: 1,
          totalAmount: { $sum: "$currentPackage" },
        },
      },
    ]);
    return result?.totalAmount || 0;
  } catch (error) {
    console.log("total package", error);
  }
};

const calculateTotalPackageAmount = async (user, nextMonth) => {
  try {
    let directUserTotalPackage = 0;
    let allUserTotalPackage = 0;

    for (const teamMember of user.team) {
      const query = {
        userId: teamMember.userId,
        isActive: true,
      };

      if (nextMonth) {
        query.rankIncomeCurrentDate = {
          $gte: user.rankIncomeCurrentDate,
          $lte: nextMonth,
        };
      }
      const activeUser = await User.findOne(query);

      if (activeUser) {
        if (teamMember.level === "1") {
          const userBusiness = await getTotalPackageRoi({
            userId: activeUser.userId,
          });
          directUserTotalPackage += userBusiness;
        }
        const userBusiness = await getTotalPackageRoi({
          userId: activeUser.userId,
        });
        allUserTotalPackage += userBusiness;
      }
    }
    return { directUserTotalPackage, allUserTotalPackage };
  } catch (error) {
    console.log("calculate package", error);
  }
};

const createRankIfConditionMet = async (
  user, // user Info
  rank, // Rank
  rewardAmount, // Rank Reward Amount
  requiredDirectUsers, // Current Rank Direct User
  requiredLevel1Business, // Current User level 1 business amount
  requiredAllLevelBusiness, // Current user all level business amount
  position, // Rank Position
  bonusAmount // Rank Bonus
) => {
  try {
    let currentDate = new Date(user.rankIncomeCurrentDate);
    currentDate.setDate(currentDate.getDate() + 30);
    const nextMonth = currentDate.getTime();
    const higherRank = await RankIncome.findOne({
      userId: user.userId,
      rankPosition: { $gt: position },
    });
    if (!higherRank) {
      const extRank = await RankIncome.findOne({
        userId: user.userId,
        rank: rank,
      });
      const extBonus = await RankIncome.findOne({
        userId: user.userId,
        rank: rank,
        bonusAmount: bonusAmount,
      });
      // Get Direct Active users
      const directActiveUsers = await getUserDirectActiveCount(user.userId);
      // Get Direct Active User and Total Topup Package amount
      const { directUserTotalPackage, allUserTotalPackage } =
        await calculateTotalPackageAmount(user, extRank ? nextMonth : false);
      // console.log(
      //   user?.userId,
      //   "User",
      //   directActiveUsers,
      //   "Direct",
      //   directUserTotalPackage,
      //   "Total",
      //   allUserTotalPackage
      //   // extRank ? nextMonth : false,
      //   // extRank?.rank
      // );

      const fullCondition =
        !extRank && // 100% condition when extRank does not exist
        directActiveUsers >= requiredDirectUsers &&
        directUserTotalPackage >= requiredLevel1Business &&
        allUserTotalPackage >= requiredAllLevelBusiness;
      const halfCondition =
        extRank && // 50% condition when extRank exists
        directUserTotalPackage >= requiredLevel1Business / 2 &&
        allUserTotalPackage >= requiredAllLevelBusiness / 2;

      // This date for getting 50% condition
      let currentDate = new Date(user.rankIncomeCurrentDate);
      currentDate.setDate(currentDate.getDate() + 31);
      const next30Days = currentDate.getTime();
      // console.log(
      //   "condition",
      //   fullCondition ? "full" : "half",
      //   isLastDayOfMonth(next30Days),
      //   halfCondition,
      //   user?.userId
      // );
      if (fullCondition || (halfCondition && isLastDayOfMonth(next30Days))) {
        const rankIncomeData = {
          userId: user.userId,
          fullName: user.fullName,
          sponsorId: user.sponsorId,
          sponsorName: user.sponsorName,
          rank: rank,
          rankPosition: position,
          rewardAmount: rewardAmount,
          date: new Date(getIstTime().date).toDateString(),
          time: getIstTime().time,
          transactionId: generateRandomString(),
        };

        if (bonusAmount && !extBonus) {
          rankIncomeData.bonusAmount = bonusAmount;
        }

        await RankIncome.create(rankIncomeData);

        const highRank = await RankIncome.findOne({
          userId: user.userId,
        }).sort({ rankPosition: -1 });
        await Wallet.findOneAndUpdate(
          { userId: user.userId },
          {
            $inc: {
              rankIncome: +rewardAmount,
              rankBonusIncome: !extBonus ? bonusAmount || 0 : 0,
              totalIncome: (!extBonus ? bonusAmount || 0 : 0) + +rewardAmount,
              activeIncome: (!extBonus ? bonusAmount || 0 : 0) + +rewardAmount,
            },
          },
          { new: true, lean: true }
        );
        await User.findOneAndUpdate(
          { userId: user.userId },
          {
            $set: {
              rankIncomeCurrentDate: new Date(getIstTime().date).getTime(),
              rank: highRank?.rank,
            },
          }
        );
      } else if (next30Days === new Date(getIstTime().date).getTime()) {
        await User.findOneAndUpdate(
          { userId: user.userId },
          {
            $set: {
              rankIncomeCurrentDate: new Date(getIstTime().date).getTime(),
            },
          }
        );
      }
    }
  } catch (error) {
    console.log("rankCondition", error);
  }
};

const rankIncome = async (req, res) => {
  try {
    const users = await User.find({ isActive: true });

    for (const user of users) {
      const today = new Date(getIstTime().date).toDateString().split(" ")[0];
      if (today === "Sat" || today === "Sun") {
        console.log("Rank Income isn't distributed on Saturday and Sunday");
        return;
      }

      createRankIfConditionMet(
        user,
        "silver",
        rankRewardAmount.SILVER.rewardAmount,
        rankRewardAmount.SILVER.directUsers,
        rankRewardAmount.SILVER.level1Business,
        rankRewardAmount.SILVER.allLevelBusiness,
        rankRewardAmount.SILVER.position,
        0
      );
      createRankIfConditionMet(
        user,
        "gold",
        rankRewardAmount.GOLD.rewardAmount,
        rankRewardAmount.GOLD.directUsers,
        rankRewardAmount.GOLD.level1Business,
        rankRewardAmount.GOLD.allLevelBusiness,
        rankRewardAmount.GOLD.position,
        0
      );
      createRankIfConditionMet(
        user,
        "ruby",
        rankRewardAmount.RUBY.rewardAmount,
        rankRewardAmount.RUBY.directUsers,
        rankRewardAmount.RUBY.level1Business,
        rankRewardAmount.RUBY.allLevelBusiness,
        rankRewardAmount.RUBY.position,
        0
      );
      createRankIfConditionMet(
        user,
        "diamond",
        rankRewardAmount.DIAMOND.rewardAmount,
        rankRewardAmount.DIAMOND.directUsers,
        rankRewardAmount.DIAMOND.level1Business,
        rankRewardAmount.DIAMOND.allLevelBusiness,
        rankRewardAmount.DIAMOND.position,
        0
      );
      createRankIfConditionMet(
        user,
        "double-diamond",
        rankRewardAmount.DOUBLE_DIAMOND.rewardAmount,
        rankRewardAmount.DOUBLE_DIAMOND.directUsers,
        rankRewardAmount.DOUBLE_DIAMOND.level1Business,
        rankRewardAmount.DOUBLE_DIAMOND.allLevelBusiness,
        rankRewardAmount.DOUBLE_DIAMOND.position,
        rankRewardAmount.DOUBLE_DIAMOND.bonus
      );
      createRankIfConditionMet(
        user,
        "platinum-diamond",
        rankRewardAmount.PLATINUM_DIAMOND.rewardAmount,
        rankRewardAmount.PLATINUM_DIAMOND.directUsers,
        rankRewardAmount.PLATINUM_DIAMOND.level1Business,
        rankRewardAmount.PLATINUM_DIAMOND.allLevelBusiness,
        rankRewardAmount.PLATINUM_DIAMOND.position,
        rankRewardAmount.PLATINUM_DIAMOND.bonus
      );
      createRankIfConditionMet(
        user,
        "double-platinum-diamond",
        rankRewardAmount.DOUBLE_PLATINUM_DIAMOND.rewardAmount,
        rankRewardAmount.DOUBLE_PLATINUM_DIAMOND.directUsers,
        rankRewardAmount.DOUBLE_PLATINUM_DIAMOND.level1Business,
        rankRewardAmount.DOUBLE_PLATINUM_DIAMOND.allLevelBusiness,
        rankRewardAmount.DOUBLE_PLATINUM_DIAMOND.position,
        rankRewardAmount.DOUBLE_PLATINUM_DIAMOND.bonus
      );
      createRankIfConditionMet(
        user,
        "crown-diamond",
        rankRewardAmount.CROWN_DIAMOND.rewardAmount,
        rankRewardAmount.CROWN_DIAMOND.directUsers,
        rankRewardAmount.CROWN_DIAMOND.level1Business,
        rankRewardAmount.CROWN_DIAMOND.allLevelBusiness,
        rankRewardAmount.CROWN_DIAMOND.position,
        rankRewardAmount.CROWN_DIAMOND.bonus
      );
      createRankIfConditionMet(
        user,
        "double-crown-diamond",
        rankRewardAmount.DOUBLE_CROWN_DIAMOND.rewardAmount,
        rankRewardAmount.DOUBLE_CROWN_DIAMOND.directUsers,
        rankRewardAmount.DOUBLE_CROWN_DIAMOND.level1Business,
        rankRewardAmount.DOUBLE_CROWN_DIAMOND.allLevelBusiness,
        rankRewardAmount.DOUBLE_CROWN_DIAMOND.position,
        rankRewardAmount.DOUBLE_CROWN_DIAMOND.bonus
      );
      createRankIfConditionMet(
        user,
        "legend-diamond",
        rankRewardAmount.LEGEND_DIAMOND.rewardAmount,
        rankRewardAmount.LEGEND_DIAMOND.directUsers,
        rankRewardAmount.LEGEND_DIAMOND.level1Business,
        rankRewardAmount.LEGEND_DIAMOND.allLevelBusiness,
        rankRewardAmount.LEGEND_DIAMOND.position,
        rankRewardAmount.LEGEND_DIAMOND.bonus
      );
      console.log("user", user?.userId);
      console.log("rank income dis");
    }
    return res.status(200).json({ message: "Rank income distributed" });
  } catch (error) {
    console.log(error);
  }
};
const isLastDayOfMonth = (timestamp) => {
  const today = new Date(getIstTime().date).getTime();
  return timestamp >= today;
};
module.exports = { rankIncome };
