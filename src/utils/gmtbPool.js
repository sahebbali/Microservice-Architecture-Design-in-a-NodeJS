const { levelIncomePercentages } = require("../constants/gmtbPool.constant");
const User = require("../models/auth.model");
const { GmtbPool, GmtbPoolInfo } = require("../models/gmtbPool.model");
const Wallet = require("../models/wallet.model");

async function calculateUpLineLevelHierarchy(
  initialParent,
  tree,
  userId,
  levelCount = 1
) {
  let treeLength = tree.length;
  let variableParent = initialParent;

  const bulkUpdateOperationsOfPool = [
    {
      updateOne: {
        filter: { userId: initialParent.userId },
        update: {
          $push: {
            child: {
              parentId: initialParent.userId,
              childId: userId,
              childLevel: levelCount,
            },
          },
        },
      },
    },
  ];

  const bulkUpdateOperationsOfWallet = [
    {
      updateOne: {
        filter: { userId: initialParent.userId },
        update: {
          $inc: {
            gmtbIncome:
              +(levelIncomePercentages["packagePrice"] / 100) *
              levelIncomePercentages[levelCount],
          },
        },
      },
    },
  ];

  for (let i = 0; i < treeLength; ) {
    const user = tree[i];

    if (user.userId === variableParent.parentId) {
      levelCount++;
      variableParent = user;
      i = 0;

      console.log(`${user.userId} ${variableParent.parentId}`);

      bulkUpdateOperationsOfPool.push({
        updateOne: {
          filter: { userId: variableParent.userId },
          update: {
            $push: {
              child: {
                parentId: variableParent.userId,
                childId: userId,
                childLevel: levelCount,
              },
            },
          },
        },
      });

      bulkUpdateOperationsOfWallet.push({
        updateOne: {
          filter: { userId: variableParent.userId },
          update: {
            $inc: {
              gmtbIncome:
                +(levelIncomePercentages["packagePrice"] / 100) *
                levelIncomePercentages[levelCount],
            },
          },
        },
      });
    } else {
      i++; // Increment i only if the condition is not met
    }
  }

  bulkUpdateOperationsOfPool.length > 0 &&
    (await GmtbPool.bulkWrite(bulkUpdateOperationsOfPool));

  bulkUpdateOperationsOfWallet.length > 0 &&
    (await Wallet.bulkWrite(bulkUpdateOperationsOfWallet));

  await GmtbPool.create({
    userId: userId,
    parentId: initialParent?.userId,
    parentOfParentId: initialParent?.parentId,
    child: [],
  });
}

async function enterToTheGmtbPool(userId, poolName) {
  const user = await User.findOne({ userId: userId });

  const gmtbPoolInfo = await GmtbPoolInfo.findOne({
    gmtbPoolName: poolName,
  });

  if (!gmtbPoolInfo) {
    await GmtbPoolInfo.create({
      gmtbPoolName: poolName,
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

    // await GmtbPool.create({
    //   gmtbPoolName: poolName,
    //   userId: userId,
    //   parentId: "root",
    //   fullName: user?.fullName,
    //   joiningDate: date,
    //   rebirthInfo: null,
    //   parentOfParentId: "root",
    // });
  } else {
    const {
      currentUpLevel,
      currentUpLevelIndex,
      currentDownLevel,
      currentDownLevelIndex,
      currentUpLevelLimit,
      thisIndex,
      treeHistory,
    } = gmtbPoolInfo;

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
        await GmtbPoolInfo.findOneAndUpdate(
          { gmtbPoolName: poolName },
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
        await GmtbPoolInfo.findOneAndUpdate(
          { gmtbPoolName: poolName },
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

      // await calculateUpLineLevelHierarchy(
      //   recentUser[0],
      //   gmtbPoolInfo.treeHistory,
      //   userId
      // );
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

        await GmtbPoolInfo.findOneAndUpdate(
          { gmtbPoolName: poolName },
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

        // await calculateUpLineLevelHierarchy(
        //   currentParent[0],
        //   gmtbPoolInfo.treeHistory,
        //   userId
        // );
      } else {
        // else up level cross it's index limit
        const previousParent = treeHistory.filter(
          (p) => currentUpLevel === p?.downLevel && p.thisChildIndex === 1
        );
        const currentParent = treeHistory.filter(
          (c) =>
            c?.parentId === previousParent[0]?.userId && c?.thisChildIndex === 1
        );

        await GmtbPoolInfo.findOneAndUpdate(
          { gmtbPoolName: poolName },
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

        // await calculateUpLineLevelHierarchy(
        //   currentParent[0],
        //   gmtbPoolInfo.treeHistory,
        //   userId
        // );
      }
    }
  }
}

module.exports = { calculateUpLineLevelHierarchy, enterToTheGmtbPool };
