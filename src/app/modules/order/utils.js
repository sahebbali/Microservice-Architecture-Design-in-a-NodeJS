const getIstTime = () => {
  d = new Date();
  utc = d.getTime() + d.getTimezoneOffset() * 60000;
  nd = new Date(utc + 3600000 * +6);
  var ist = nd.toLocaleString();
  let time = ist.split(", ")[1];
  let date = ist.split(", ")[0];
  return { time, date };
};

module.exports = getIstTime;
