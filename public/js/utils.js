/* ---- utilitaires génériques ---- */
export function escapeAttr(str){
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
