const formatDate = date => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
};

const formatTime = seconds => {
  if (seconds < 60) return `${seconds} seconds`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds - hours * 3600) / 60);
  const secondsRemaining = seconds - minutes * 60;

  if (seconds < 3600) {
    return `${minutes} minutes and ${secondsRemaining} seconds`;
  }
  return `${hours} hours, ${minutes} minutes and ${secondsRemaining} seconds`;
};

module.exports.formatDate = formatDate;
module.exports.formatTime = formatTime;
