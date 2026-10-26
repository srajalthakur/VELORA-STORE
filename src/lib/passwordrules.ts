const COMMON = new Set(["password", "password1", "password12", "password123", "1234567890", "12345678910", "qwertyuiop", "iloveyou123", "welcome123", "letmein1234", "admin12345", "abcdefghij", "0123456789"]);

/** Returns a message when the password is not acceptable, or null when it is. Length matters more than symbols. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters";
  if (pw.length > 200) return "Use 200 characters or fewer";
  if (new Set(pw).size < 4) return "Use a password with more variety";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common. Choose another";
  return null;
}
