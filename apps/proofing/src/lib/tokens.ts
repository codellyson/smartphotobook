/** Random base64url string suitable for share/reaction tokens. */
export function newToken(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function r2Key(token: string, idx: number): string {
  return `p/${token}/${idx}.jpg`;
}
