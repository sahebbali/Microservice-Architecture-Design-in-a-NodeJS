const User = require("../models/auth.model");
const { PackageBuyInfo, PackageRoi } = require("../models/topup.model");
const getIstTime = require("../config/getTime");
const {
  levelCommissionPerCentage,
  forbiddenDates,
} = require("../constants/topup.constants");
const LevelIncome = require("../models/levelIncome.model");
const generateString = require("../config/generateRandomString");
const Wallet = require("../models/wallet.model");
const Level = require("../models/level.model");

const levelIncome = async (req, res) => {
  const today = new Date(getIstTime().date).toDateString().split(" ")[0];
  if (
    forbiddenDates.includes(
      new Date(getIstTime().date)
        .toDateString()
        .split(" ")
        .slice(1, 3)
        .join(" ")
    )
  ) {
    console.log("Level Income isn't distributed on Dec 24 to Jan 03");
    return res
      .status(400)
      .json({ message: "Level Income isn't distributed on Dec 24 to Jan 03" });
  }
  if (today === "Sat" || today === "Sun") {
    console.log("Level Income isn't distributed on Saturday and Sunday");
    return res.status(400).json({
      message: "Level Income isn't distributed on Saturday and Sunday",
    });
  }

  try {
    const levelUsers = await Level.find({});

    const userCache = new Map();

    const userIds = levelUsers.map((user) => user.userId);

    await Promise.all(
      userIds.map(async (userId) => {
        const user = await User.findOne({ userId }).exec();
        if (user) {
          userCache.set(userId, user);
        }
      })
    );

    for (const user of levelUsers) {
      const sponsor = userCache.get(user.userId);

      if (!sponsor || !sponsor.isActive) {
        continue; // Skip inactive sponsors
      }

      const userLevelIds = user.level.map((level) => level.userId);

      const levelUserPromises = userLevelIds.map(async (userId) => {
        const levelUser = userCache.get(userId);
        if (levelUser && levelUser.isActive) {
          return levelUser;
        }
        return null;
      });

      const levelUsersData = await Promise.all(levelUserPromises);

      for (const [index, levelUser] of levelUsersData.entries()) {
        if (levelUser) {
          const levelRois = await PackageRoi.findOne({
            userId: levelUser?.userId,
          });
          if (levelRois?.history?.length < 1) {
            continue;
          }
          const { time, date } = getIstTime();
          const levelMoney =
            levelUser.packageInfo?.amount *
            (levelCommissionPerCentage[`${user.level[index].level}`] / 100);

          // Update Wallet using bulk operation
          await Wallet.updateOne(
            { userId: user.userId },
            {
              $inc: {
                activeIncome: +levelMoney,
                totalIncome: +levelMoney,
                levelIncome: +levelMoney,
                directIncome: user.level[index].level === "1" ? +levelMoney : 0,
                indirectIncome:
                  user.level[index].level === "1" ? 0 : +levelMoney,
              },
            }
          );

          const packageInfo = await PackageBuyInfo.findOne({
            userId: levelUser.userId,
          })
            .sort({ createdAt: -1 })
            .exec();

          const selfPackageInfo = await PackageBuyInfo.findOne({
            userId: sponsor.userId,
          })
            .sort({ createdAt: -1 })
            .exec();

          // Create LevelIncome documents using bulk operation
          const levelIncomeData = {
            userId: sponsor.userId,
            fullName: sponsor.fullName,
            incomeFrom: levelUser.userId,
            incomeFromFullName: levelUser.fullName,
            level: `${user.level[index].level}`,
            amount: levelMoney,
            date: new Date(date).toDateString(),
            time: time,
            levelUserPackageInfo: packageInfo?.packageInfo,
            selfPackageInfo: selfPackageInfo?.packageInfo,
            transactionID: generateString(15),
          };
          await LevelIncome.create(levelIncomeData);
        }
      }
    }
    console.log("Level Income Distributed");
    return res.status(200).json({ message: "Level Income Distributed" });
  } catch (error) {
    console.log("error occured", error);
  }
};

module.exports = levelIncome;
