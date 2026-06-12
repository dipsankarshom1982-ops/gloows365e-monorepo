export const calculateScore = ({
  likes,
  views,
  shares,
  watchTime,
  judgeScore = 0,
}: any) => {
  return (
    likes * 0.3 +
    views * 0.1 +
    shares * 0.2 +
    watchTime * 0.1 +
    judgeScore * 0.3
  );
};