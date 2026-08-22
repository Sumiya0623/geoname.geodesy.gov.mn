export const NAVBAR_ICON_BASE_PATH = "/assets/icons/navbar";

export const humanizeNavbarIconName = (value) =>
  value
    .replace(/^ic_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const createNavbarIconOption = (name) => ({
  value: name,
  label: humanizeNavbarIconName(name),
  src: `${NAVBAR_ICON_BASE_PATH}/${name}.svg`,
});

export const normalizeNavbarIconFilename = (filename) =>
  filename.replace(/\.svg$/i, "");
