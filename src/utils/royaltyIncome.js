const generateString = require("../config/generateRandomString");
const getIstTime = require("../config/getTime");
const User = require("../models/auth.model");
const { Royalty } = require("../models/royalty.model");
const { RoyalIncome } = require("../models/royaltyIncome.model");
const CreateRank = async (
  userId,
  fullName,
  sponsorId,
  sponsorName,
  rank,
  rankPosition,
  royalAmount,
  currentCap
) => {
  const { date, time } = getIstTime();
  const today = new Date(date).toDateString();
  let currentDate = new Date(today);
  currentDate.setDate(currentDate.getDate() + 31);
  const nextMonth = currentDate.getTime();
  const existRank = await RoyalIncome.findOne({ userId, rank });

  if (existRank) {
    await RoyalIncome.findOneAndUpdate(
      { userId, royaltyId: existRank?.royaltyId },
      {
        $inc: {
          royalAmount: +royalAmount,
          pendingRoyal: +royalAmount,
          count: +1,
        },
        $set: {
          provideDate: new Date(nextMonth).toDateString(),
          provideDateInt: nextMonth,
        },
      }
    );
  } else {
    await RoyalIncome.create({
      userId,
      fullName,
      sponsorId,
      sponsorName,
      rank,
      rankPosition,
      royalAmount,
      pendingRoyal: royalAmount,
      currentCap,
      count: 1,
      provideDate: new Date(nextMonth).toDateString(),
      provideDateInt: nextMonth,
      date: today,
      time,
      transactionId: generateString(13),
      royaltyId: generateString(13),
    });
  }
};
const CreateRoyalty = async (
  userId,
  fullName,
  sponsorId,
  sponsorName,
  rank,
  term,
  rankPosition,
  royalAmount,
  currentCap
) => {
  const { date, time } = getIstTime();
  const today = new Date(date).toDateString();
  let currentDate = new Date(today);
  currentDate.setDate(currentDate.getDate() + 31);
  const nextMonth = currentDate.getTime();

  await Royalty.create({
    userId,
    fullName,
    sponsorId,
    sponsorName,
    rank,
    term,
    rankPosition,
    royalAmount,
    // pendingRoyal: royalAmount,
    currentCap,
    // count: 1,
    provideDate: new Date(nextMonth).toDateString(),
    provideDateInt: nextMonth,
    date: today,
    time,
    transactionId: generateString(13),
  });
};
const CurrentTerm = (user) => {
  let term = "";
  if (user?.teamSlot1 === 50) {
    // for silver rank
    term = "slot-1-50";
  } else if (user?.teamPersonalTeamPackage === 5) {
    term = "personal-team-package-5";
  } else if (user?.teamGlobalTeamPackage === 5) {
    term = "global-team-package-5";
  } else if (user?.teamSlot5 === 5) {
    term = "slot-5-5";
  } else if (user?.teamVIP1 === 5) {
    term = "VIP1-5";
  } else if (user?.teamVIP2 === 5) {
    term = "VIP2-5";
  } else if (user?.teamSlot1 === 100) {
    // for gold rank
    term = "slot-1-100";
  } else if (user?.teamPersonalTeamPackage === 10) {
    term = "personal-team-package-10";
  } else if (user?.teamGlobalTeamPackage === 10) {
    term = "global-team-package-10";
  } else if (user?.teamSlot5 === 10) {
    term = "slot-5-10";
  } else if (user?.teamVIP1 === 10) {
    term = "VIP1-10";
  } else if (user?.teamVIP2 === 10) {
    term = "VIP2-10";
  } else if (user?.teamSlot1 === 200) {
    // for Emerald Rank
    term = "slot-1-200";
  } else if (user?.teamPersonalTeamPackage === 20) {
    term = "personal-team-package-20";
  } else if (user?.teamGlobalTeamPackage === 20) {
    term = "global-team-package210";
  } else if (user?.teamSlot5 === 20) {
    term = "slot-5-20";
  } else if (user?.teamVIP1 === 20) {
    term = "VIP1-20";
  } else if (user?.teamVIP2 === 20) {
    term = "VIP2-20";
  } else if (user?.teamSlot1 === 300) {
    // for Diamond rank
    term = "slot-1-300";
  } else if (user?.teamPersonalTeamPackage === 40) {
    term = "personal-team-package-40";
  } else if (user?.teamGlobalTeamPackage === 40) {
    term = "global-team-package-40";
  } else if (user?.teamSlot5 === 40) {
    term = "slot-5-40";
  } else if (user?.teamVIP1 === 40) {
    term = "VIP1-40";
  } else if (user?.teamVIP2 === 40) {
    term = "VIP2-40";
  } else if (user?.teamSlot1 === 500) {
    // for Crown Ambassador rank
    term = "slot-1-500";
  } else if (user?.teamPersonalTeamPackage === 100) {
    term = "personal-team-package-100";
  } else if (user?.teamGlobalTeamPackage === 100) {
    term = "global-team-package-100";
  } else if (user?.teamSlot5 === 100) {
    term = "slot-5-100";
  } else if (user?.teamVIP1 === 100) {
    term = "VIP1-100";
  } else if (user?.teamVIP2 === 100) {
    term = "VIP2-100";
  }

  return term;
};

const RoyaltyIncome = async (userId, amount) => {
  // console?.log(userId, amount);

  const currentUser = await User.findOne({ userId });

  if (amount === 35) {
    console.log("hello 35");
    await User.findOneAndUpdate(
      { userId: currentUser?.sponsorId },
      {
        $inc: {
          teamSlot1: +1,
        },
      },
      { new: true }
    );
  } else if (amount === 75) {
    console.log("hello 75");
    await User.findOneAndUpdate(
      { userId: currentUser?.sponsorId },
      {
        $inc: {
          teamPersonalTeamPackage: +1,
        },
      },
      { new: true }
    );
  } else if (amount === 76) {
    // console.log("hello 76");
    await User.findOneAndUpdate(
      { userId: currentUser?.sponsorId },
      {
        $inc: {
          teamGlobalTeamPackage: +1,
        },
      },
      { new: true }
    );
  } else if (amount === 560) {
    await User.findOneAndUpdate(
      { userId: currentUser?.sponsorId },
      {
        $inc: {
          teamSlot5: +1,
        },
      },
      { new: true }
    );
  }

  const ParentUser = await User.findOne({ userId: currentUser?.sponsorId });
  const term = CurrentTerm(ParentUser);
  // console.log({ term });
  if (
    ParentUser?.teamSlot1 === 50 ||
    (ParentUser.buySlot5 && ParentUser?.teamSlot5 === 5) ||
    ParentUser?.teamGlobalTeamPackage === 5 ||
    ParentUser?.teamPersonalTeamPackage === 5 ||
    ParentUser?.teamVIP1 === 5 ||
    ParentUser?.teamVIP2 === 5
  ) {
    // console?.log("hello silver rank");
    await CreateRank(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "silver",
      1,
      2000,
      50
    );
    await CreateRoyalty(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "silver",
      term,
      1,
      2000,
      50
    );
  } else if (
    ParentUser?.teamSlot1 === 1000 ||
    (ParentUser.buySlot5 && ParentUser?.teamSlot5 === 10) ||
    ParentUser?.teamGlobalTeamPackage === 10 ||
    ParentUser?.teamPersonalTeamPackage === 10 ||
    ParentUser?.teamVIP1 === 10 ||
    ParentUser?.teamVIP2 === 10
  ) {
    await CreateRank(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "gold",
      2,
      4000,
      100
    );
    await CreateRoyalty(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "gold",
      term,
      2,
      4000,
      100
    );
  } else if (
    ParentUser?.teamSlot1 === 200 ||
    (ParentUser.buySlot5 && ParentUser?.teamSlot5 === 20) ||
    ParentUser?.teamGlobalTeamPackage === 20 ||
    ParentUser?.teamPersonalTeamPackage === 20 ||
    ParentUser?.teamVIP1 === 20 ||
    ParentUser?.teamVIP2 === 20
  ) {
    await CreateRank(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "emerald",
      3,
      8000,
      0
    );
    await CreateRoyalty(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "emerald",
      term,
      3,
      8000,
      0
    );
  } else if (
    ParentUser?.teamSlot1 === 300 ||
    (ParentUser.buySlot5 && ParentUser?.teamSlot5 === 40) ||
    ParentUser?.teamGlobalTeamPackage === 40 ||
    ParentUser?.teamPersonalTeamPackage === 40 ||
    ParentUser?.teamVIP1 === 40 ||
    ParentUser?.teamVIP2 === 40
  ) {
    await CreateRank(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "diamond",
      4,
      16000,
      0
    );
    await CreateRoyalty(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "diamond",
      term,
      4,
      16000,
      0
    );
  } else if (
    ParentUser?.teamSlot1 === 500 ||
    (ParentUser.buySlot5 && ParentUser?.teamSlot5 === 100) ||
    ParentUser?.teamGlobalTeamPackage === 100 ||
    ParentUser?.teamPersonalTeamPackage === 100 ||
    ParentUser?.teamVIP1 === 100 ||
    ParentUser?.teamVIP2 === 100
  ) {
    // console?.log("hello crowin");
    await CreateRank(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "crown-ambassador",
      5,
      50000,
      0
    );
    await CreateRoyalty(
      ParentUser?.userId,
      ParentUser?.fullName,
      ParentUser?.sponsorId,
      ParentUser?.sponsorName,
      "crown-ambassador",
      term,
      5,
      50000,
      0
    );
  }
};
module.exports = RoyaltyIncome;
