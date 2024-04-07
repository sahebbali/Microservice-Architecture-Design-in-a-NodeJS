const generateString = require("../config/generateRandomString");
const generateUniqueUserID = require("../config/generateUniqueUserID");
const getIstTime = require("../config/getTime");
const { slots } = require("../constants/autoPool.constant");
const User = require("../models/auth.model");
const {
  AutoPool,
  AutoPoolInfo,
  AutoPoolIncome,
} = require("../models/autoPool.model");
const Level = require("../models/level.model");
const Wallet = require("../models/wallet.model");

async function isDirectUsersHasSamePackage(ownerId, slotId, directCount = 3) {
  // const pipeline = [
  //   {
  //     $match: { sponsorId: ownerId },
  //   },
  //   {
  //     $project: { userId: 1, _id: 0 },
  //   },
  //   {
  //     $limit: directCount, // Limit the number of documents retrieved to 'directCount'
  //   },
  //   {
  //     $lookup: {
  //       from: "autoPools",
  //       let: { userId: "$userId" },
  //       pipeline: [
  //         {
  //           $match: {
  //             $expr: { $eq: ["$userId", "$$userId"] },
  //             slotId: slotId,
  //           },
  //         },
  //       ],
  //       as: "autoPoolData",
  //     },
  //   },
  //   {
  //     $match: {
  //       autoPoolData: { $ne: [] }, // Filter out documents that do not have matching autoPoolData
  //     },
  //   },
  //   {
  //     $count: "matchedDirectUsers", // Count the number of matched direct users
  //   },
  // ];

  // const result = await Level.aggregate(pipeline);

  // return result.length === directCount;
  const directUsers = await Level.find({ sponsorId: ownerId }).select({
    userId: 1,
    _id: 0,
  });

  let countToThree = 0;
  for (const id of directUsers) {
    if (countToThree < directCount) {
      const isExist = await AutoPool.findOne({ userId: id, slotId: slotId });
      if (isExist) {
        countToThree++;
      }
    } else {
      break;
    }
  }

  return countToThree >= directCount;
}

async function generateUniqueRebirthId(slotId, ownerId) {
  const count = await AutoPool.countDocuments({
    slotId: slotId,
    "rebirthInfo.rootOwnerId": ownerId,
  });

  const id = `${ownerId}-R${count + 1}`;

  return id;
}

async function calculateLevelUpgrade(
  userId,
  incomingUserId,
  slotId,
  levelCount,
  income
) {
  const currentParent = await AutoPool.findOneAndUpdate(
    { userId: userId, slotId: slotId },
    {
      $inc: {
        totalDownLineUsers: 1,
        temporaryStore: income ? income : 0,
      },
    },
    { new: true }
  );

  const { fullName, parentId, rebirthInfo, currentLevel, temporaryStore } =
    currentParent || {};
  const reBirthInfoObj = rebirthInfo;
  const name = fullName;

  const isCurrentLevelShouldUpgrade =
    slots[slotId][currentLevel]?.totalCurrentLevelAmount === temporaryStore;

  return {
    name,
    parentId,
    reBirthInfoObj,
    currentLevel,
    temporaryStore,
    isCurrentLevelShouldUpgrade,
  };
}

async function calculateAutoPoolUpLineLevelHierarchy(
  initialParent,
  incomingUserId,
  slotId,
  rebirthInfo = null,
  fullName,
  joiningDate,
  levelCount = 1
) {
  /*
  Here we are creating the reference/document of the new incoming user or the incoming re-birth user.
  */
  await AutoPool.create({
    slotId: slotId,
    userId: incomingUserId,
    fullName: fullName,
    joiningDate: joiningDate,
    parentId: initialParent?.userId,
    rebirthInfo: rebirthInfo,
    parentOfParentId: initialParent?.parentId,
  });

  const IstTime = getIstTime();
  const date = new Date(IstTime?.date).toDateString();
  const time = IstTime?.time;

  // ............ Level 1 functionalities started here...............

  /*
    Here this function is calculating that does the current parent completed the level 1 of a particular slot pool.
  */
  const income = slots[slotId].downLineCommission;
  const {
    name,
    parentId,
    reBirthInfoObj,
    currentLevel,
    temporaryStore,
    isCurrentLevelShouldUpgrade,
  } = await calculateLevelUpgrade(
    initialParent?.userId,
    incomingUserId,
    slotId,
    levelCount,
    income
  );

  /*  After completing level 1 there are few steps:
    1. Deduct X amount for upgrading to 2nd level
    2. Give the deducted money to the parent
    3. Update owner's wallet with profit
    4. Create history of auto pool income also re-birth id's auto pool income
    5. Generate and enter a new re-birth id to the auto pool
  */
  if (isCurrentLevelShouldUpgrade) {
    const amountOf2ndLevelUpgrade =
      slots[slotId][currentLevel]?.upgradingCostAmount;

    const netProfit = temporaryStore - amountOf2ndLevelUpgrade;

    const bulkUpdateAutoPool = [];

    //  Step 1: Deduct X amount for upgrading to 2nd level
    bulkUpdateAutoPool.push({
      updateOne: {
        filter: { userId: initialParent?.userId, slotId: slotId },
        update: {
          $inc: { currentLevel: 1, temporaryStore: -temporaryStore },
        },
      },
    });

    // Step 2: Give the deducted money to the parent
    bulkUpdateAutoPool.push({
      updateOne: {
        filter: { userId: parentId, slotId: slotId },
        update: {
          $inc: { temporaryStore: amountOf2ndLevelUpgrade },
        },
      },
    });

    // Step 3: Update owner's wallet with profit
    const ownerId = reBirthInfoObj
      ? reBirthInfoObj.rootOwnerId
      : initialParent?.userId;

    /*
      Here, "isDirectUsersHasSamePackage" checking that this owner is eligible to withdraw the income. If not income will be freeze till eligibility.
      */
    const isTrue = await isDirectUsersHasSamePackage(ownerId, slotId, 3);

    const { freezedAmount } = await AutoPool.findOne({
      userId: ownerId,
      slotId: slotId,
    }).select({ freezedAmount: 1, _id: 0 });

    // If three direct has same package then retrieve all the freeze amount and put it to active income
    bulkUpdateAutoPool.push({
      updateOne: {
        filter: { userId: ownerId, slotId: slotId },
        update: {
          $set: {
            freezedAmount: isTrue ? 0 : freezedAmount + netProfit,
          },
        },
      },
    });

    const walletUpdate = {
      $inc: {
        totalIncome: netProfit,
        autoPoolIncome: netProfit,
        regularAutoPoolIncome: reBirthInfoObj ? 0 : netProfit,
        rebirthIdsAutoPoolIncome: reBirthInfoObj ? netProfit : 0,
        activeIncome: isTrue ? netProfit + freezedAmount : 0,
      },
    };

    await Promise.all([
      AutoPool.bulkWrite(bulkUpdateAutoPool),
      Wallet.updateOne({ userId: ownerId }, walletUpdate),
      // Step 4: Create history of auto pool income also re-birth id's auto pool income
      AutoPoolIncome.create({
        slotId: slotId,
        userId: ownerId,
        fullName: name,
        reBirthId: reBirthInfoObj ? initialParent?.userId : null,
        amount: netProfit,
        currentLevel: currentLevel,
        transactionId: generateString(16),
        date: date,
        time: time,
      }),
      // Step 5: Generate and enter a new re-birth id to the auto pool
      generateUniqueRebirthId(slotId, ownerId).then((generatedId) =>
        enterToTheAutoPool(generatedId, slotId, {
          fullName: name,
          rootOwnerId: reBirthInfoObj
            ? reBirthInfoObj.rootOwnerId
            : initialParent?.userId,
          immediateOwnerId: initialParent?.userId,
        })
      ),
    ]);
  }
  // ...................... ........................................
  // ...................... ........................................

  // ............. Level 2 and the rest of the levels functionalities started here...............
  let variableParent = initialParent;

  while (variableParent?.parentId !== "root") {
    levelCount++;
    const currentParentId = variableParent?.parentId;

    const {
      name,
      parentId,
      reBirthInfoObj,
      currentLevel,
      temporaryStore,
      isCurrentLevelShouldUpgrade,
    } = await calculateLevelUpgrade(
      currentParentId,
      incomingUserId,
      slotId,
      levelCount
    );

    /*  After completing current level there are few steps:
    1. Deduct X amount for upgrading to 2nd level
    2. Give the deducted money to the parent
    3. Update owner's wallet with profit
    4. Create history of auto pool income also re-birth id's auto pool income
    5. Generate and enter a new re-birth id to the auto pool
    6. After upgrade the level upgrade next slot accordingly
  */
    if (isCurrentLevelShouldUpgrade) {
      const amountOfNextLevelUpgrade =
        slots[slotId][currentLevel]?.upgradingCostAmount;
      const reBirthCounter = slots[slotId][currentLevel]?.reBirthIdCount;
      const reBirthDeductingAmount = reBirthCounter * income;
      const nextSlotCharge =
        currentLevel >= 4 ? slots[slotId][currentLevel]?.slot?.slotCharge : 0;
      const slotIds =
        currentLevel >= 4 ? slots[slotId][currentLevel]?.slot?.slotIds : [];

      const netProfit =
        temporaryStore -
        (amountOfNextLevelUpgrade + reBirthDeductingAmount + nextSlotCharge);

      const bulkUpdateAutoPool = [];

      //  Step 1: Deduct X amount for upgrading to 2nd level
      bulkUpdateAutoPool.push({
        updateOne: {
          filter: { userId: currentParentId, slotId: slotId },
          update: {
            $inc: {
              currentLevel: 1,
              temporaryStore: -temporaryStore,
            },
          },
        },
      });

      // Step 2: Give the deducted money to the parent
      bulkUpdateAutoPool.push({
        updateOne: {
          filter: { userId: parentId, slotId: slotId },
          update: {
            $inc: { temporaryStore: amountOfNextLevelUpgrade },
          },
        },
      });

      // Step 3: Update owner's wallet with profit
      /* 
       Here we are finding that if the current income holder is a re-birth/copy user then who is the original holder/user. Because all the re-birth user's incomes will be send to the original person's wallet.
      */
      const ownerId = reBirthInfoObj
        ? reBirthInfoObj?.rootOwnerId
        : currentParentId;

      /*
      Here, "isDirectUsersHasSamePackage" checking that this owner is eligible to withdraw the income. If not income will be freeze till eligibility.
      */
      const isTrue = await isDirectUsersHasSamePackage(ownerId, slotId, 3);

      const { freezedAmount } = await AutoPool.findOne({
        userId: ownerId,
        slotId: slotId,
      }).select({ freezedAmount: 1, _id: 0 });

      // If three direct has same package then retrieve all the freeze amount and put it to active income
      bulkUpdateAutoPool.push({
        updateOne: {
          filter: { userId: ownerId, slotId: slotId },
          update: {
            $set: {
              freezedAmount: isTrue ? 0 : freezedAmount + netProfit,
            },
          },
        },
      });

      const walletUpdate = {
        $inc: {
          totalIncome: netProfit,
          autoPoolIncome: netProfit,
          regularAutoPoolIncome: reBirthInfoObj ? 0 : netProfit,
          rebirthIdsAutoPoolIncome: reBirthInfoObj ? netProfit : 0,
          activeIncome: isTrue ? netProfit + freezedAmount : 0,
        },
      };

      await Promise.all([
        AutoPool.bulkWrite(bulkUpdateAutoPool),
        Wallet.updateOne({ userId: ownerId }, walletUpdate),
        // Step 4: Create history of auto pool income also re-birth id's auto pool income
        AutoPoolIncome.create({
          slotId: slotId,
          userId: ownerId,
          fullName: name,
          reBirthId: reBirthInfoObj ? currentParentId : null,
          amount: netProfit,
          currentLevel: currentLevel,
          transactionId: generateString(16),
          date: date,
          time: time,
        }),
        // Step 5: Generate and enter a new re-birth id to the auto pool
        (async () => {
          for (let i = 1; i <= reBirthCounter; i++) {
            const generatedId = await generateUniqueRebirthId(slotId, ownerId);
            await enterToTheAutoPool(generatedId, slotId, {
              fullName: name,
              rootOwnerId: reBirthInfoObj
                ? reBirthInfoObj?.rootOwnerId
                : currentParentId,
              immediateOwnerId: currentParentId,
            });
          }
        })(),
      ]);

      // Step 6: Send the current user to the specific slot according to the level
      if (slotIds.length > 0) {
        for (const slotId of slotIds) {
          await enterToTheAutoPool(
            currentParentId,
            slotId,
            !reBirthInfoObj
              ? null
              : {
                  fullName: name,
                  rootOwnerId: reBirthInfoObj?.rootOwnerId,
                  immediateOwnerId: currentParentId,
                }
          );
        }
      }
    }

    variableParent = { parentId: parentId };
  }
}

async function enterToTheAutoPool(userId, slotId, rebirthInfo) {
  const user = await User.findOne({ userId: userId });
  const IstTime = getIstTime();
  const date = new Date(IstTime?.date).toDateString();

  const autoPoolInfo = await AutoPoolInfo.findOne({
    slotId: slotId,
  });

  if (!autoPoolInfo) {
    await AutoPoolInfo.create({
      slotId: slotId,
      currentUpLevel: 1,
      currentUpLevelIndex: 1,
      currentDownLevel: 1,
      currentDownLevelIndex: 0,
      currentUpLevelLimit: 1,
      thisIndex: 0,
      treeHistory: [
        {
          userId: userId,
          parentId: "root",
          upLevel: 1,
          downLevel: 1,
          thisIndex: 0,
          thisChildIndex: 1,
        },
      ],
    });

    await AutoPool.create({
      slotId: slotId,
      userId: userId,
      parentId: "root",
      fullName: user?.fullName,
      joiningDate: date,
      rebirthInfo: null,
      parentOfParentId: "root",
    });
  } else {
    const isAlreadyExistInPool = await AutoPool.findOne({
      slotId: slotId,
      userId: userId,
    });
    // Here we are checking the incoming user is already in the slot pool. If so then generate a re-birth id of the user and get into pool. Because an user's original id cannot be twice in a slot pool.
    if (isAlreadyExistInPool) {
      // Here we are checking the incoming user is the original user or re-birth user.
      const newOwnerId = userId;
      if (!isAlreadyExistInPool.rebirthInfo) {
        rebirthInfo = {
          fullName: user.fullName,
          rootOwnerId: newOwnerId,
          immediateOwnerId: newOwnerId,
        };
      } else {
        const { rootOwnerId, fullName } = isAlreadyExistInPool.rebirthInfo;
        rebirthInfo = {
          fullName: fullName,
          rootOwnerId: rootOwnerId,
          immediateOwnerId: newOwnerId,
        };
      }

      userId = await generateUniqueRebirthId(slotId, rebirthInfo.rootOwnerId);
    }
    // ...........................................

    const {
      currentUpLevel,
      currentUpLevelIndex,
      currentDownLevel,
      currentDownLevelIndex,
      currentUpLevelLimit,
      thisIndex,
      treeHistory,
    } = autoPoolInfo;

    let currentDownLevelChild;
    let recentUser;

    if (currentUpLevel > 2) {
      const recentU = treeHistory.filter(
        (p) =>
          p.downLevel === currentUpLevel && currentUpLevelIndex === p.thisIndex
      );
      recentUser = recentU;
    } else {
      const recentU = treeHistory.filter(
        (p) =>
          p.downLevel === currentUpLevel &&
          currentUpLevelIndex === p.thisChildIndex
      );

      recentUser = recentU;
    }

    currentDownLevelChild = treeHistory.filter(
      (p) => p.parentId === recentUser[0]?.userId
    );

    if (currentDownLevelChild?.length < 3) {
      let currentParentId = recentUser[0]?.userId;

      if (recentUser[0]?.parentId === "root" && currentDownLevelIndex === 0) {
        await AutoPoolInfo.findOneAndUpdate(
          { slotId: slotId },
          {
            $set: {
              currentUpLevel: currentUpLevel,
              currentUpLevelIndex: currentUpLevelIndex,
              currentDownLevel: currentDownLevel + 1,
              currentDownLevelIndex: currentDownLevelIndex + 1,
              currentUpLevelLimit: currentUpLevelLimit,
              thisIndex: thisIndex + 1,
              treeHistory: [
                ...treeHistory,
                {
                  userId: userId,
                  upLevel: currentUpLevel,
                  downLevel: currentDownLevel + 1,
                  parentId: currentParentId,
                  thisChildIndex: currentDownLevelIndex + 1,
                  thisIndex: thisIndex + 1,
                },
              ],
            },
          }
        );
      } else {
        await AutoPoolInfo.findOneAndUpdate(
          { slotId: slotId },
          {
            $set: {
              currentUpLevel: currentUpLevel,
              currentUpLevelIndex: currentUpLevelIndex,
              currentDownLevel: currentDownLevel,
              currentDownLevelIndex: currentDownLevelIndex + 1,
              currentUpLevelLimit: currentUpLevelLimit,
              thisIndex: thisIndex + 1,
              treeHistory: [
                ...treeHistory,
                {
                  userId: userId,
                  upLevel: currentUpLevel,
                  downLevel: currentDownLevel,
                  parentId: currentParentId,
                  thisChildIndex: currentDownLevelIndex + 1,
                  thisIndex: thisIndex + 1,
                },
              ],
            },
          }
        );
      }

      await calculateAutoPoolUpLineLevelHierarchy(
        recentUser[0],
        userId,
        slotId,
        rebirthInfo,
        user ? user.fullName : rebirthInfo.fullName,
        date
      );
    } else {
      // check up level cross it's index limit or not
      // if it's not cross it's index limit then switch up level index to +1 and make that index as current head node
      // if it's cross it's limit then switch to it's down line find that down line's 1st index and make it current head node
      if (currentUpLevelIndex !== currentUpLevelLimit) {
        // here if up level is not cross the index limit
        const currentParent = treeHistory.filter(
          (p) =>
            currentUpLevel === p?.downLevel &&
            p?.thisIndex === currentUpLevelIndex + 1
        );

        await AutoPoolInfo.findOneAndUpdate(
          { slotId: slotId },
          {
            $set: {
              currentUpLevel: currentUpLevel,
              currentUpLevelIndex: currentUpLevelIndex + 1,
              currentDownLevel: currentDownLevel,
              currentDownLevelIndex:
                currentDownLevelIndex < 3 ? currentDownLevelIndex + 1 : 1,
              currentUpLevelLimit: currentUpLevelLimit,
              thisIndex: thisIndex + 1,
              treeHistory: [
                ...treeHistory,
                {
                  userId,
                  upLevel: currentUpLevel,
                  downLevel: currentDownLevel,
                  parentId: currentParent[0]?.userId,
                  thisChildIndex:
                    currentDownLevelIndex < 3 ? currentDownLevelIndex + 1 : 1,
                  thisIndex: thisIndex + 1,
                },
              ],
            },
          }
        );

        await calculateAutoPoolUpLineLevelHierarchy(
          currentParent[0],
          userId,
          slotId,
          rebirthInfo,
          user ? user.fullName : rebirthInfo.fullName,
          date
        );
      } else {
        // else up level cross it's index limit
        const previousParent = treeHistory.filter(
          (p) => currentUpLevel === p?.downLevel && p.thisChildIndex === 1
        );
        const currentParent = treeHistory.filter(
          (c) =>
            c?.parentId === previousParent[0]?.userId && c?.thisChildIndex === 1
        );

        await AutoPoolInfo.findOneAndUpdate(
          { slotId: slotId },
          {
            $set: {
              currentUpLevel: currentParent[0]?.downLevel,
              currentUpLevelIndex: currentParent[0]?.thisIndex,
              currentDownLevel: currentParent[0]?.downLevel + 1,
              currentDownLevelIndex: 1,
              currentUpLevelLimit: Math.pow(3, currentParent[0]?.downLevel - 1),
              thisIndex: 1,
              treeHistory: [
                ...treeHistory,
                {
                  userId: userId,
                  upLevel: currentParent[0]?.downLevel,
                  downLevel: currentParent[0]?.downLevel + 1,
                  parentId: currentParent[0]?.userId,
                  thisChildIndex: 1,
                  thisIndex: 1,
                },
              ],
            },
          }
        );

        await calculateAutoPoolUpLineLevelHierarchy(
          currentParent[0],
          userId,
          slotId,
          rebirthInfo,
          user ? user.fullName : rebirthInfo.fullName,
          date
        );
      }
    }
  }
}

module.exports = {
  enterToTheAutoPool,
};

/**
 * Case 1: Check that the user cannot get into slot 2 before slot 1 and so on. OK and fixed
 * Case 2: Check that the user completed level 1 and got 5 dollars net income with 1 rebirth id. OK
 * Case 3: Check that the user completed level 4 and got 10 dollars net income with 4 rebirth id and got slot 2 entry. OK
 * Case 4: Check that if the user is already in the slot his original id will not get into that slot twice. There will be a new re birth id. OK
 * Case 5: Check that the user will be able to withdraw a specific slot income when he has three direct active users who bought that specific slot package also. NOT OK
 * Case 6: Completing level 15's all features are correctly working? PENDING
 * Case 7: Other slot functionalities are correctly working? PENDING
 * **/
