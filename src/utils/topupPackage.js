const getIstTime = require("../config/getTime");
const { getIstTimeWithInternet } = require("../config/internetTime");
const User = require("../models/auth.model");
const { PackageBuyInfo, PackageRoi } = require("../models/topup.model");
const Wallet = require("../models/wallet.model");

const topupPackageBuyInfoCreate = async (currentUser, type, packageAmount) => {
  await PackageBuyInfo.create({
    userId: currentUser.userId,
    userFullName: currentUser.fullName,
    sponsorId: currentUser.sponsorId,
    sponsorName: currentUser.sponsorName,
    packageInfo: {
      amount: packageAmount,
      date: new Date(getIstTime().date).toDateString(),
      time: getIstTime().time,
    },
    packageType: type,
  });
};

const topupWalletUpdate = async (
  depositBalance,
  activeIncome,
  packageAmount,
  userId
) => {
  // First Deposit Amount then active amount
  depositBalance >= packageAmount
    ? await Wallet.findOneAndUpdate(
        { userId: userId },
        {
          $inc: {
            depositBalance: -packageAmount,
            investmentAmount: +packageAmount,
          },
        }
      )
    : await Wallet.findOneAndUpdate(
        { userId: userId },
        {
          $set: {
            depositBalance: 0,
            activeIncome: activeIncome - (packageAmount - depositBalance),
          },
          $inc: {
            investmentAmount: +packageAmount,
          },
        }
      );

  // First active amount then deposit amount
  // activeIncome >= packageAmount
  //   ? await Wallet.findOneAndUpdate(
  //       { userId: userId },
  //       {
  //         $inc: {
  //           activeIncome: -packageAmount,
  //           investmentAmount: +packageAmount,
  //         },
  //       }
  //     )
  //   : await Wallet.findOneAndUpdate(
  //       { userId: userId },
  //       {
  //         $set: {
  //           activeIncome: 0,
  //           depositBalance: depositBalance - (packageAmount - activeIncome),
  //         },
  //         $inc: {
  //           investmentAmount: +packageAmount,
  //         },
  //       }
  //     );
};

const processPackageAction = async (
  userId,
  packageAmount,
  prevPackDeductPackAmount,
  extPackageBuyInfo,
  depositBalance,
  activeIncome,
  startDate,
  actionType,
  type
) => {
  const isttime = await getIstTimeWithInternet();
  const today = new Date(isttime.date).toDateString().split(" ")[0];
  const satAndSun = today === "Sat" || today === "Sun";
  await topupWalletUpdate(
    depositBalance,
    activeIncome,
    prevPackDeductPackAmount,
    userId
  );
  // Get Current user
  const updatedUser = await User.findOneAndUpdate(
    { userId: userId },
    {
      $set: {
        isActive: true,
        activationDate: new Date(isttime.date).toDateString(), //          actionType === "Buy" &&
        packageInfo: {
          amount: packageAmount,
        },
      },
    },
    { new: true }
  );

  await topupPackageBuyInfoCreate(
    updatedUser,
    actionType === "Buy" ? "Buy" : "Upgrade",
    packageAmount
  );

  actionType === "Upgrade" || type === "Again Buy"
    ? await PackageRoi.findOneAndUpdate(
        { userId: userId },
        {
          $set: {
            currentPackage: packageAmount,
            isActive: true,
            isMondayCheck: satAndSun ? false : true,
          },
          $push: {
            previousPackage: {
              amount: extPackageBuyInfo?.packageInfo?.amount,
              startDate: extPackageBuyInfo?.packageInfo?.date,
              endDate: new Date(isttime.date).toDateString(),
            },
          },
        }
      )
    : await PackageRoi.create({
        email: updatedUser.email,
        userId: updatedUser.userId,
        fullName: updatedUser.fullName,
        packageId:
          Date.now().toString(36) + Math.random().toString(36).substring(2),
        currentPackage: packageAmount,
        sponsorId: updatedUser.sponsorId,
        isActive: true,
        isMondayCheck: satAndSun ? false : true,
        incomeDay: 0,
        totalReturnedAmount: 0,
        startDate: startDate.toDateString(),
        history: [],
      });
  // await levelIncome(updatedUser, packageAmount);
};
module.exports = {
  topupPackageBuyInfoCreate,
  topupWalletUpdate,
  processPackageAction,
};
