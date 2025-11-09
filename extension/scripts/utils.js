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

function extractEmailsFromText(text) {
  const emails = extractEmails(text);
  return emails.filter(email => !email.endsWith('google.com'));
}

function getAuthuserFromURL(url) {
  try {
    const urlObj = new URL(url);
    const authuser = urlObj.searchParams.get('authuser');
    return authuser !== null ? parseInt(authuser, 10) : null;
  } catch (e) {
    return null;
  }
}
