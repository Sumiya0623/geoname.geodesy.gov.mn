/**
 * Борлуулахад бэлэн цэг тэмдэгтийг шалгах функц
 * @param {String} name Point Name
 * @returns {Boolean} status
 */
export const statusCheck = (name) => {
  const status = name === "Хэвийн"
  return status;
};
