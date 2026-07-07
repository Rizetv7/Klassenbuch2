export function isAminaName(name: string | null | undefined): boolean {
  if (!name) return false;
  const firstName = name.trim().split(/\s+/)[0] || "";
  return firstName.toLocaleLowerCase("de-CH") === "amina";
}
