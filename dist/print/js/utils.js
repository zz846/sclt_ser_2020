const shortdate = dtstr => {
  if (dtstr == "-") {
    return "-";
  } else {
    const dt = new Date(dtstr);
    return `${dt.getFullYear()}-${
      dt.getMonth() + 1 < 10 ? "0" + (dt.getMonth() + 1) : dt.getMonth() + 1
      }-${dt.getDate() < 10 ? "0" + dt.getDate() : dt.getDate()}`;
  }
};

const longdate = dtstr => {
  if (dtstr == "-") {
    return "-";
  } else {
    const dt = new Date(dtstr);
    return `${shortdate(dtstr)} ${
      dt.getHours() < 10 ? "0" + dt.getHours() : dt.getHours()
      }:${dt.getMinutes() < 10 ? "0" + dt.getMinutes() : dt.getMinutes()}`;
  }
};

//计算两个日期相差天数
const days = (dt1str, dt2str) => {
  let dateStart = new Date(dt1str);
  let dateEnd = new Date(dt2str);
  return (dateEnd - dateStart) / (1000 * 60 * 60 * 24);
};
