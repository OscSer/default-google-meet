function extractEmails(text) {
  const emails = new Set();
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b/gu;
  let match;

  while ((match = emailRegex.exec(text)) !== null) {
    const email = match[0];
    if (email) {
      emails.add(email);
    }
  }
  return Array.from(emails);
}
