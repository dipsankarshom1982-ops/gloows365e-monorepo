export const addRanking = (list: any[], prevRanks: any = {}) => {
  return list.map((item, index) => {
    const newRank = index + 1;
    const oldRank = prevRanks[item.userId];

    let trend = "same";

    if (oldRank) {
      if (newRank < oldRank) trend = "up";
      else if (newRank > oldRank) trend = "down";
    }

    return {
      ...item,
      rank: newRank,
      trend,
    };
  });
};