export const XAU_EAS = ["EA01", "EA02", "EA02V2", "EA03", "EA04", "EA05", "EA06", "EA07", "EA_NEWS_TICKSPEED", "EA_NEWS_SPIKEHUNTER"];
export const BTC_EAS = ["EA01_BTC", "EA02_BTC", "EA03_BTC"];
export const OIL_EAS = ["EA01_USOIL", "EA02_USOIL", "EA03_USOIL"];

export type AssetType = "XAU" | "BTC" | "USOIL";

export const getAsset = (name: string = "", strategy: string = ""): AssetType => {
  const str = (name + " " + strategy).toUpperCase();
  if (str.includes("BTC")) return "BTC";
  if (str.includes("USOIL") || str.includes("OIL") || str.includes("CRUDE")) return "USOIL";
  return "XAU";
};

export const getEaCode = (id: string, name: string = ""): string => {
  const nameMatch = name.match(/^(EA\d+(?:V\d+)?)/i);
  const matchedName = nameMatch?.[1];
  if (matchedName) return matchedName.toUpperCase();

  const idUpper = id.toUpperCase();
  if (idUpper.startsWith("EA02V2")) return "EA02V2";
  const numMatch = idUpper.match(/EA(\d+)/i);
  const matchedNum = numMatch?.[1];
  if (matchedNum) return `EA${matchedNum.padStart(2, "0")}`;
  return idUpper;
};

export const formatEaDisplayName = (id: string, name: string = "") => {
  const code = getEaCode(id, name);
  const cleanName = name.replace(new RegExp(`^${code}_?`, "i"), "");
  return {
    code,
    cleanName: cleanName || name,
    fullName: `${code}_${cleanName || name}`,
  };
};

export const getEaTimeframe = (asset: AssetType): string => {
  if (asset === "XAU") return "M5";
  return "M15";
};
