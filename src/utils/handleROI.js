const generateRandomString = require("../config/generateRandomId");
const getIstTime = require("../config/getTime");
const {
  forbiddenDates,
  roiCommissionPercentage,
} = require("../constants/topup.constants");
const { PackageRoi, PackageBuyInfo } = require("../models/topup.model");
const Wallet = require("../models/wallet.model");
const LastRoiData = require("../models/lastRoiData");

const handleROI = async () => {
  try {
    {
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
        console.log("ROI isn't distributed on Dec 24 to Jan 03");
        return res
          .status(400)
          .json({ message: "ROI isn't distributed on Dec 24 to Jan 03" });
      }
      if (today === "Sat" || today === "Sun") {
        console.log("ROI isn't distributed on Saturday and Sunday");
        return res
          .status(400)
          .json({ message: "ROI isn't distributed on Saturday and Sunday" });
      }
      const extRoi = await PackageRoi.find({ isActive: true }).select(
        "-history"
      );
      const userIds = extRoi.map((ext) => ext.userId);

      const upgradeDates = await PackageBuyInfo.find({
        userId: { $in: userIds },
        packageType: "Upgrade",
      })
        .sort({ createdAt: -1 })
        .then((upgradeDates) => {
          const upgradeDateMap = new Map();
          upgradeDates.forEach((date) => upgradeDateMap.set(date.userId, date));
          return upgradeDateMap;
        });

      const newTopupDates = await PackageBuyInfo.find({
        userId: { $in: userIds },
        packageType: "Buy",
      })
        .sort({ createdAt: -1 })
        .then((newTopupDates) => {
          const newTopupDateMap = new Map();
          newTopupDates.forEach((date) =>
            newTopupDateMap.set(date.userId, date)
          );
          return newTopupDateMap;
        });

      await Promise.all(
        extRoi.map(async (ext) => {
          const userId = ext.userId;
          const upgradeDateCheck = upgradeDates.get(userId);
          const newTopupDateCheck = newTopupDates.get(userId);

          console.log({ userId });

          let packAmount = 0;
          if (ext.isMondayCheck === false) {
            if (
              (upgradeDateCheck?.packageInfo?.date.split(" ")[0] === "Sat" ||
                upgradeDateCheck?.packageInfo?.date.split(" ")[0] === "Sun") &&
              today === "Mon"
            ) {
              packAmount =
                ext.previousPackage[ext.previousPackage?.length - 1].amount;
              await mainFuncOfROI(ext, packAmount);
            }
            if (
              (newTopupDateCheck?.packageInfo?.date.split(" ")[0] === "Sat" ||
                newTopupDateCheck?.packageInfo?.date.split(" ")[0] === "Sun") &&
              today === "Mon"
            ) {
              await PackageRoi.findOneAndUpdate(
                { packageId: ext.packageId, isMondayCheck: false },
                { $set: { isMondayCheck: true } }
              );
            }
          } else {
            packAmount = ext.currentPackage;
            await mainFuncOfROI(ext, packAmount);
          }
        })
      );
      console.log("Distribute ROI");
    }
    {
      function getISTDate() {
        // Get current date and time in UTC
        const currentDate = new Date();

        // Create an Intl.DateTimeFormat object for Indian Standard Time (IST)
        const istOptions = {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        };
        const istFormatter = new Intl.DateTimeFormat("en-IN", istOptions);

        // Format the date in IST
        const istDateStr = istFormatter.format(currentDate);

        return istDateStr;
      }
      // Example usage
      const istDate = getISTDate();
      console.log({ istDate });
      await LastRoiData.findOneAndUpdate(
        {},
        {
          date: istDate,
        },
        { upsert: true }
      );
    }
  } catch (error) {
    console.log(error);
  }
};

const mainFuncOfROI = async (ext, prevPackAmount) => {
  if (ext.isActive) {
    // const prevPackAmount = packAmount;
    const incomeDayInc = ext.incomeDay + 1;
    const roiPerDayCommissionAmount =
      prevPackAmount <= 500
        ? (prevPackAmount / 100) * roiCommissionPercentage.thirtyTo5Hundred
        : prevPackAmount >= 700 && prevPackAmount <= 3500
        ? (prevPackAmount / 100) * roiCommissionPercentage.sevenHundredTo3k
        : (prevPackAmount / 100) * roiCommissionPercentage.fiveKToN;
    const roiPerDayCommissionPercentage =
      prevPackAmount <= 500
        ? roiCommissionPercentage.thirtyTo5Hundred
        : prevPackAmount >= 700 && prevPackAmount <= 3500
        ? roiCommissionPercentage.sevenHundredTo3k
        : roiCommissionPercentage.fiveKToN;

    await Wallet.findOneAndUpdate(
      { userId: ext.userId },
      {
        $inc: {
          roiIncome: +roiPerDayCommissionAmount,
          totalIncome: +roiPerDayCommissionAmount,
          activeIncome: +roiPerDayCommissionAmount,
        },
      },
      { new: true }
    );

    await PackageRoi.findOneAndUpdate(
      { packageId: ext.packageId },
      {
        $inc: {
          incomeDay: +1,
          totalReturnedAmount: +roiPerDayCommissionAmount,
        },
        $set: {
          isMondayCheck: true,
        },
        $push: {
          history: {
            userId: ext.userId,
            fullName: ext.fullName,
            package: prevPackAmount,
            commissionPercentagePerDay: roiPerDayCommissionPercentage,
            commissionAmount: Number(roiPerDayCommissionAmount).toFixed(3),
            totalCommissionAmount: Number(
              ext?.totalReturnedAmount + roiPerDayCommissionAmount
            ).toFixed(3),
            incomeDay: incomeDayInc,
            incomeDate: new Date(getIstTime().date).toDateString(),
            incomeTime: getIstTime().time,
            incomeDateInt: new Date(getIstTime().date).getTime(),
            transactionId: generateRandomString(),
          },
        },
      }
    );
  }
};

module.exports = handleROI;
