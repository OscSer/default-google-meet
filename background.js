// Background script for Google Meet Extension
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed
  console.log('Google Meet extension installed');
  
  // Start periodic account validation
  startAccountValidation();
});

// Start periodic account validation
function startAccountValidation() {
  // Validate accounts every 30 minutes
  const VALIDATION_INTERVAL = 30 * 60 * 1000; // 30 minutes
  
  // Initial validation after 5 seconds
  setTimeout(() => {
    validateAndFixStoredAccounts();
  }, 5000);
  
  // Periodic validation
  setInterval(() => {
    validateAndFixStoredAccounts();
  }, VALIDATION_INTERVAL);
  
  console.log('Account validation system started');
}

// Store for cached accounts
let cachedAccounts = [];
let lastAccountFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to get user info using Chrome Identity API
async function getUserInfo(token) {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }
    return await response.json();
  } catch (error) {
    return null;
  }
}

// Function to detect the current authuser index for a given email using Google's endpoints
async function detectCurrentAuthuser(email) {
  try {
    console.log(`Detecting authuser for email: ${email}`);
    
    // Use Google's endpoints to get accounts in the correct order
    const accounts = await getGoogleAccountsWithAuthuser();
    
    console.log('Google accounts:', accounts);
    
    // Find the email in the accounts array - the index is the authuser
    const account = accounts.find(acc => acc.email === email);
    
    if (account) {
      console.log(`Found authuser ${account.authuser} for email ${email} using Google endpoints`);
      return account.authuser;
    }
    
    console.log(`Email ${email} not found in Google accounts`);
    
    // Fallback: try the old detection methods if Google endpoints don't work
    console.log('Falling back to alternative detection methods...');
    const fallbackResult = await detectAuthuserFallback(email);
    
    if (fallbackResult !== null) {
      console.log(`Fallback detection found authuser ${fallbackResult} for email ${email}`);
      return fallbackResult;
    }
    
    console.log(`Could not detect valid authuser for email: ${email}`);
    return null;
  } catch (error) {
    console.error('Error detecting authuser:', error);
    
    // If Google endpoints fail, try fallback methods
    try {
      const fallbackResult = await detectAuthuserFallback(email);
      if (fallbackResult !== null) {
        console.log(`Fallback detection found authuser ${fallbackResult} for email ${email}`);
        return fallbackResult;
      }
    } catch (fallbackError) {
      console.error('Fallback detection also failed:', fallbackError);
    }
    
    return null;
  }
}

// Fallback detection method for when Chrome Identity API fails
async function detectAuthuserFallback(email) {
  try {
    // Method 1: Try to detect from Google account picker page
    const pickerResult = await detectAuthuserFromAccountPicker(email);
    if (pickerResult !== null) {
      console.log(`Detected authuser ${pickerResult} from account picker`);
      return pickerResult;
    }
    
    // Method 2: Try different authuser indices and check which one loads the correct account
    console.log('Trying different authuser indices...');
    for (let i = 0; i < 10; i++) {
      const isValid = await validateAuthuserPrecise(i, email);
      if (isValid) {
        console.log(`Found valid authuser index ${i} for email ${email}`);
        return i;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in fallback detection:', error);
    return null;
  }
}

// Method to detect authuser from Google account picker
async function detectAuthuserFromAccountPicker(email) {
  try {
    const response = await fetch('https://accounts.google.com/AccountChooser', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      return null;
    }
    
    const responseText = await response.text();
    
    // Look for account information in the response
    const accountPattern = new RegExp(`"email"\\s*:\\s*"${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*"authuser"\\s*:\\s*"?(\\d+)"?`, 'i');
    const match = responseText.match(accountPattern);
    
    if (match) {
      return parseInt(match[1]);
    }
    
    // Alternative pattern - look for authuser in account selection links
    const linkPattern = new RegExp(`authuser=(\\d+)[^>]*${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    const linkMatch = responseText.match(linkPattern);
    
    if (linkMatch) {
      return parseInt(linkMatch[1]);
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting authuser from account picker:', error);
    return null;
  }
}

// More precise validation method
async function validateAuthuserPrecise(authuserIndex, expectedEmail) {
  try {
    console.log(`Precise validation for authuser ${authuserIndex} with email ${expectedEmail}`);
    
    // Use Google's account info endpoint
    const testUrl = `https://myaccount.google.com/profile?authuser=${authuserIndex}`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.log(`Request failed for authuser ${authuserIndex}: ${response.status}`);
      return false;
    }
    
    const responseText = await response.text();
    
    // Check if the response contains the expected email
    const emailPattern = new RegExp(expectedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const hasEmail = emailPattern.test(responseText);
    
    // Check if the response indicates this is the active account
    const hasActiveAccount = responseText.includes('"active":true') || 
                           responseText.includes('data-active="true"') ||
                           responseText.includes('class="active"');
    
    // Check if the authuser parameter is reflected in the response
    const hasCorrectAuthuser = responseText.includes(`authuser=${authuserIndex}`) ||
                             responseText.includes(`"authuser":"${authuserIndex}"`);
    
    console.log(`Validation result for authuser ${authuserIndex}: hasEmail=${hasEmail}, hasActiveAccount=${hasActiveAccount}, hasCorrectAuthuser=${hasCorrectAuthuser}`);
    
    return hasEmail && (hasActiveAccount || hasCorrectAuthuser);
  } catch (error) {
    console.error(`Error in precise validation for authuser ${authuserIndex}:`, error);
    return false;
  }
}

// Function to validate if an authuser index works for a given email
async function validateAuthuser(authuserIndex, expectedEmail) {
  try {
    console.log(`Validating authuser ${authuserIndex} for email ${expectedEmail}`);
    
    // Use the precise validation method first
    const preciseResult = await validateAuthuserPrecise(authuserIndex, expectedEmail);
    if (preciseResult) {
      return true;
    }
    
    // Fallback to other validation methods
    const validationMethods = [
      () => validateAuthuserWithAccountChooser(authuserIndex, expectedEmail),
      () => validateAuthuserWithMeetURL(authuserIndex, expectedEmail),
      () => validateAuthuserWithMyAccount(authuserIndex, expectedEmail)
    ];
    
    for (const method of validationMethods) {
      try {
        const result = await method();
        if (result) {
          console.log(`Validation successful for authuser ${authuserIndex} using method ${method.name}`);
          return true;
        }
      } catch (error) {
        console.warn(`Validation method ${method.name} failed for authuser ${authuserIndex}:`, error);
      }
    }
    
    console.log(`All validation methods failed for authuser ${authuserIndex}`);
    return false;
  } catch (error) {
    console.error(`Error validating authuser ${authuserIndex}:`, error);
    return false;
  }
}

// Validation method 1: Using Account Chooser
async function validateAuthuserWithAccountChooser(authuserIndex, expectedEmail) {
  const testUrl = `https://accounts.google.com/AccountChooser?authuser=${authuserIndex}&continue=https://meet.google.com`;
  
  const response = await fetch(testUrl, {
    method: 'GET',
    credentials: 'include'
  });
  
  if (!response.ok) {
    return false;
  }
  
  const responseText = await response.text();
  const emailPattern = new RegExp(expectedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const hasEmail = emailPattern.test(responseText);
  const hasAuthuser = responseText.includes(`authuser=${authuserIndex}`) || 
                     responseText.includes(`"authuser":"${authuserIndex}"`);
  
  return hasEmail && hasAuthuser;
}

// Validation method 2: Using Meet URL
async function validateAuthuserWithMeetURL(authuserIndex, expectedEmail) {
  const testUrl = `https://meet.google.com/?authuser=${authuserIndex}`;
  
  const response = await fetch(testUrl, {
    method: 'GET',
    credentials: 'include'
  });
  
  if (!response.ok) {
    return false;
  }
  
  const responseText = await response.text();
  const emailPattern = new RegExp(expectedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  
  return emailPattern.test(responseText);
}

// Validation method 3: Using My Account
async function validateAuthuserWithMyAccount(authuserIndex, expectedEmail) {
  const testUrl = `https://myaccount.google.com/profile?authuser=${authuserIndex}`;
  
  const response = await fetch(testUrl, {
    method: 'GET',
    credentials: 'include'
  });
  
  if (!response.ok) {
    return false;
  }
  
  const responseText = await response.text();
  const emailPattern = new RegExp(expectedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  
  return emailPattern.test(responseText);
}

// Function to get all Google accounts with their authuser indices using Google's ListAccounts endpoint
async function getGoogleAccountsWithAuthuser() {
  try {
    console.log('Getting Google accounts with authuser mapping...');
    
    // First, try the enhanced Account Chooser endpoint from the plan
    const accountChooserAccounts = await getActiveAccountsFromAccountChooser();
    if (accountChooserAccounts.length > 0) {
      console.log('Found accounts from Account Chooser endpoint:', accountChooserAccounts);
      return accountChooserAccounts;
    }
    
    // Fallback to original ListAccounts endpoint
    const response = await fetch('https://accounts.google.com/ListAccounts', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.log('Could not access Google ListAccounts');
      return [];
    }
    
    const responseText = await response.text();
    console.log('ListAccounts response length:', responseText.length);
    
    // Parse the response to extract account information
    const accounts = [];
    
    // Look for account data in the response
    // Google's response format may vary, so we try multiple patterns
    const patterns = [
      // Pattern 1: JSON-like structure
      /"email"\s*:\s*"([^"]+)"/g,
      // Pattern 2: Account chooser format
      /data-email="([^"]+)"/g,
      // Pattern 3: JavaScript variable format
      /email['"]\s*:\s*['"]([^'"]+)['"]/g
    ];
    
    const foundEmails = new Set();
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(responseText)) !== null) {
        const email = match[1];
        if (email && email.includes('@') && !foundEmails.has(email)) {
          foundEmails.add(email);
        }
      }
    }
    
    // Convert to array and create authuser mapping
    const emailArray = Array.from(foundEmails);
    const mappedAccounts = emailArray.map((email, index) => ({
      email: email,
      authuser: index
    }));
    
    console.log('Google accounts with authuser mapping:', mappedAccounts);
    
    // If we didn't find any accounts, try alternative methods
    if (mappedAccounts.length === 0) {
      console.log('No accounts found in ListAccounts, trying alternative methods...');
      // Try Account Chooser first
      const chooserAccounts = await getAccountsFromAccountChooser();
      if (chooserAccounts.length > 0) {
        return chooserAccounts;
      }
      // If that fails, try cookie-based detection
      return await getAccountsFromCookies();
    }
    
    return mappedAccounts;
  } catch (error) {
    console.error('Error getting Google accounts:', error);
    // Fallback to account chooser method
    return await getAccountsFromAccountChooser();
  }
}

// Alternative method to get accounts from Account Chooser
async function getAccountsFromAccountChooser() {
  try {
    console.log('Getting accounts from Account Chooser...');
    
    const response = await fetch('https://accounts.google.com/AccountChooser', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.log('Could not access Account Chooser');
      return [];
    }
    
    const responseText = await response.text();
    
    // Look for accounts in the Account Chooser response
    const accountPattern = /"email"\s*:\s*"([^"]+)"[^}]*"authuser"\s*:\s*"?(\d+)"?/g;
    const accounts = [];
    let match;
    
    while ((match = accountPattern.exec(responseText)) !== null) {
      accounts.push({
        email: match[1],
        authuser: parseInt(match[2])
      });
    }
    
    // Sort by authuser to ensure correct order
    accounts.sort((a, b) => a.authuser - b.authuser);
    
    console.log('Accounts from Account Chooser:', accounts);
    return accounts;
  } catch (error) {
    console.error('Error getting accounts from Account Chooser:', error);
    return [];
  }
}

// Method to get accounts from cookies
async function getAccountsFromCookies() {
  try {
    console.log('Getting accounts from cookies...');
    
    // Get relevant Google cookies
    const cookies = await new Promise((resolve) => {
      chrome.cookies.getAll({
        domain: '.google.com'
      }, resolve);
    });
    
    console.log('Found cookies:', cookies.length);
    
    // Look for session cookies that might contain account info
    const sessionCookies = cookies.filter(cookie => 
      cookie.name.includes('SID') || 
      cookie.name.includes('HSID') ||
      cookie.name.includes('SSID') ||
      cookie.name.includes('ACCOUNT_CHOOSER') ||
      cookie.name.includes('LSID') ||
      cookie.name.includes('1P_JAR')
    );
    
    console.log('Session cookies found:', sessionCookies.length);
    
    // Try to detect accounts by testing different authuser values
    const accounts = [];
    
    for (let i = 0; i < 10; i++) {
      try {
        const email = await detectEmailForAuthuser(i);
        if (email) {
          accounts.push({
            email: email,
            authuser: i
          });
        }
      } catch (error) {
        // Continue to next authuser
      }
    }
    
    console.log('Accounts detected from cookies:', accounts);
    return accounts;
  } catch (error) {
    console.error('Error getting accounts from cookies:', error);
    return [];
  }
}

// Enhanced method to get active accounts via Google Account Chooser endpoint with cookies
async function getActiveAccountsFromAccountChooser() {
  try {
    console.log('Getting active accounts from Account Chooser endpoint...');
    
    // Use the specific endpoint mentioned in the plan
    const accountChooserUrl = 'https://accounts.google.com/v3/signin/accountchooser?flowName=GlifWebSignIn&flowEntry=AccountChooser';
    
    // Add timeout for network requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(accountChooserUrl, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    // Handle different response statuses
    if (!response.ok) {
      console.log(`Account Chooser endpoint not accessible: ${response.status} ${response.statusText}`);
      
      // If endpoint is not available, try fallback methods
      if (response.status === 404 || response.status === 403) {
        console.log('Trying fallback Account Chooser endpoint...');
        return await getAccountsFromAccountChooserFallback();
      }
      
      return [];
    }
    
    const responseText = await response.text();
    
    // Validate response content
    if (!responseText || responseText.length < 100) {
      console.warn('Account Chooser response seems empty or too short, trying fallback...');
      return await getAccountsFromAccountChooserFallback();
    }
    
    console.log('Account Chooser response length:', responseText.length);
    
    // Debug: Check if response contains email patterns
    const basicEmailMatches = responseText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (basicEmailMatches) {
      console.log('Basic email matches found:', basicEmailMatches.length, 'first few:', basicEmailMatches.slice(0, 3));
    } else {
      console.log('No basic email matches found in response');
    }
    
    // Parse the response to extract account information
    const accounts = [];
    
    // Enhanced patterns for account data extraction
    const accountPatterns = [
      // Pattern 1: JSON-like structure with account data
      /"accounts"\s*:\s*\[([^\]]+)\]/g,
      // Pattern 2: Individual account objects
      /\{[^}]*"email"\s*:\s*"([^"]+)"[^}]*"authuser"\s*:\s*"?(\d+)"?[^}]*\}/g,
      // Pattern 3: Account list in JavaScript variables
      /var\s+accountData\s*=\s*(\[.*?\]);/g,
      // Pattern 4: Account information in data attributes
      /data-account-email="([^"]+)"[^>]*data-account-authuser="(\d+)"/g,
      // Pattern 5: Account selection links
      /href="[^"]*authuser=(\d+)[^"]*"[^>]*>([^<]*@[^<]*)</g,
      // Pattern 6: Email addresses with nearby authuser parameters
      /"email"\s*:\s*"([^"]+@[^"]+)"/g,
      // Pattern 7: Simple email extraction for fallback
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
    ];
    
    // Extract accounts using different patterns
    for (const pattern of accountPatterns) {
      let match;
      while ((match = pattern.exec(responseText)) !== null) {
        try {
          if (pattern.source.includes('accounts')) {
            // Handle account list pattern
            const accountsData = JSON.parse(match[1]);
            if (Array.isArray(accountsData)) {
              accountsData.forEach((account, index) => {
                if (account.email && account.email.includes('@')) {
                  accounts.push({
                    email: account.email,
                    authuser: account.authuser || index,
                    name: account.name || account.displayName,
                    avatar: account.avatar || account.picture,
                    active: account.active || false
                  });
                }
              });
            }
          } else if (match[1] && match[1].includes('@')) {
            // Handle individual account patterns
            const email = match[1];
            const authuser = match[2] ? parseInt(match[2]) : accounts.length;
            
            // Skip if we already have this email
            if (!accounts.find(acc => acc.email === email)) {
              accounts.push({
                email: email,
                authuser: authuser,
                active: responseText.includes(`"active":true`) && responseText.indexOf(`"active":true`) < responseText.indexOf(email)
              });
            }
          }
        } catch (e) {
          console.warn('Could not parse account data:', e);
        }
      }
    }
    
    // If no accounts found with sophisticated patterns, try basic email extraction
    if (accounts.length === 0 && basicEmailMatches) {
      console.log('No accounts found with patterns, trying basic email extraction...');
      
      // Filter out common false positives and extract unique emails
      const filteredEmails = basicEmailMatches.filter(email => 
        !email.includes('noreply') && 
        !email.includes('support') && 
        !email.includes('no-reply') &&
        !email.includes('example.com') &&
        !email.endsWith('@google.com') &&
        !email.includes('googleusercontent.com') &&
        !email.includes('gstatic.com') &&
        email.length > 5
      );
      
      // Remove duplicates and create accounts
      const uniqueEmails = [...new Set(filteredEmails)];
      console.log('Unique emails found:', uniqueEmails.length);
      
      uniqueEmails.forEach((email, index) => {
        // Try to find authuser in the context around the email
        const emailIndex = responseText.indexOf(email);
        if (emailIndex !== -1) {
          const context = responseText.substring(Math.max(0, emailIndex - 200), emailIndex + 200);
          const authuserMatch = context.match(/authuser[=:]\s*(\d+)/i);
          const authuser = authuserMatch ? parseInt(authuserMatch[1]) : index;
          
          accounts.push({
            email: email,
            authuser: authuser,
            source: 'basic_extraction'
          });
        }
      });
    }
    
    // Alternative parsing: Look for cookie-based account information
    if (accounts.length === 0) {
      console.log('No accounts found in response, trying cookie extraction...');
      const cookieAccounts = await extractAccountsFromCookies();
      accounts.push(...cookieAccounts);
    }
    
    // Validate and clean up accounts
    const validAccounts = accounts.filter(account => 
      account.email && 
      account.email.includes('@') && 
      typeof account.authuser === 'number' && 
      account.authuser >= 0
    );
    
    // Remove duplicates based on email
    const uniqueAccounts = validAccounts.filter((account, index, self) =>
      index === self.findIndex(a => a.email === account.email)
    );
    
    // Sort by authuser to ensure correct order
    uniqueAccounts.sort((a, b) => a.authuser - b.authuser);
    
    console.log('Active accounts from Account Chooser:', uniqueAccounts);
    return uniqueAccounts;
  } catch (error) {
    console.error('Error getting active accounts from Account Chooser:', error);
    
    // Handle specific error cases
    if (error.name === 'AbortError') {
      console.log('Account Chooser request timed out, trying fallback...');
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.log('Network error accessing Account Chooser, trying fallback...');
    }
    
    // Try fallback method
    try {
      return await getAccountsFromAccountChooserFallback();
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError);
      return [];
    }
  }
}

// Fallback method for Account Chooser when primary endpoint fails
async function getAccountsFromAccountChooserFallback() {
  try {
    console.log('Using fallback Account Chooser method...');
    
    // Try multiple fallback endpoints
    const fallbackUrls = [
      'https://accounts.google.com/AccountChooser',
      'https://accounts.google.com/signin/v2/accountchooser',
      'https://accounts.google.com/o/oauth2/v2/accountchooser'
    ];
    
    for (const url of fallbackUrls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const responseText = await response.text();
          
          if (responseText && responseText.length > 100) {
            console.log(`Fallback URL ${url} worked`);
            
            // Try to extract accounts from this response
            const accounts = [];
            const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            let match;
            
            while ((match = emailPattern.exec(responseText)) !== null) {
              const email = match[0];
              
              // Skip common false positives
              if (!email.includes('noreply') && 
                  !email.includes('support') && 
                  !email.includes('no-reply') &&
                  !email.includes('example.com') &&
                  !email.includes('google.com')) {
                
                // Try to find associated authuser
                const authuserMatch = responseText.match(new RegExp(`authuser[=:](\\d+)[^}]*${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
                const authuser = authuserMatch ? parseInt(authuserMatch[1]) : accounts.length;
                
                if (!accounts.find(acc => acc.email === email)) {
                  accounts.push({
                    email: email,
                    authuser: authuser,
                    source: 'fallback'
                  });
                }
              }
            }
            
            if (accounts.length > 0) {
              return accounts;
            }
          }
        }
      } catch (e) {
        console.warn(`Fallback URL ${url} failed:`, e);
      }
    }
    
    // If all fallback URLs fail, try cookie extraction
    console.log('All fallback URLs failed, trying cookie extraction...');
    return await extractAccountsFromCookies();
  } catch (error) {
    console.error('All fallback methods failed:', error);
    return [];
  }
}

// Helper function to extract accounts from cookies
async function extractAccountsFromCookies() {
  try {
    const accounts = [];
    
    // Get all Google cookies with timeout protection
    const cookies = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Cookie retrieval timed out'));
      }, 5000);
      
      chrome.cookies.getAll({
        domain: '.google.com'
      }, (cookies) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(cookies || []);
        }
      });
    });
    
    if (!cookies || cookies.length === 0) {
      console.log('No Google cookies found');
      return [];
    }
    
    // Look for specific cookies that contain account information
    const accountCookies = cookies.filter(cookie => 
      cookie.name.includes('ACCOUNT') ||
      cookie.name.includes('CHOOSER') ||
      cookie.name.includes('LSID') ||
      cookie.name.includes('SID') ||
      cookie.name === 'APISID' ||
      cookie.name === 'SAPISID'
    );
    
    console.log('Found account-related cookies:', accountCookies.length);
    
    if (accountCookies.length === 0) {
      console.log('No account-related cookies found');
      return [];
    }
    
    for (const cookie of accountCookies) {
      try {
        // Safely decode cookie value
        let cookieValue;
        try {
          cookieValue = decodeURIComponent(cookie.value);
        } catch (decodeError) {
          console.warn(`Could not decode cookie ${cookie.name}:`, decodeError);
          cookieValue = cookie.value; // Use raw value if decoding fails
        }
        
        // Skip empty or very short cookie values
        if (!cookieValue || cookieValue.length < 10) {
          continue;
        }
        
        // Look for email patterns in cookie values
        const emailMatches = cookieValue.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        
        if (emailMatches && emailMatches.length > 0) {
          emailMatches.forEach((email, index) => {
            // Validate email format
            if (!email.includes('@') || email.length < 5) {
              return;
            }
            
            // Skip common false positives
            if (email.includes('noreply') || 
                email.includes('support') || 
                email.includes('no-reply') ||
                email.includes('example.com') ||
                email.endsWith('@google.com') ||
                email.includes('googleusercontent.com') ||
                email.includes('gstatic.com')) {
              return;
            }
            
            // Try multiple approaches to find authuser
            let authuser = index;
            
            // Approach 1: Look for authuser near the email
            const authuserMatch = cookieValue.match(new RegExp(`${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^}]*authuser[=:]?(\\d+)`, 'i'));
            if (authuserMatch) {
              authuser = parseInt(authuserMatch[1]);
            } else {
              // Approach 2: Look for authuser anywhere in the cookie
              const generalAuthuserMatch = cookieValue.match(/authuser[=:]?(\d+)/i);
              if (generalAuthuserMatch) {
                authuser = parseInt(generalAuthuserMatch[1]);
              }
            }
            
            // Validate authuser
            if (authuser < 0 || authuser > 20) {
              authuser = index;
            }
            
            if (!accounts.find(acc => acc.email === email)) {
              accounts.push({
                email: email,
                authuser: authuser,
                source: 'cookie',
                cookieName: cookie.name
              });
            }
          });
        }
      } catch (e) {
        console.warn(`Could not parse cookie ${cookie.name}:`, e);
      }
    }
    
    // Sort accounts by authuser for consistency
    accounts.sort((a, b) => a.authuser - b.authuser);
    
    console.log('Extracted accounts from cookies:', accounts);
    return accounts;
  } catch (error) {
    console.error('Error extracting accounts from cookies:', error);
    
    // If cookie extraction fails completely, return empty array
    return [];
  }
}

// Helper function to detect email for a specific authuser
async function detectEmailForAuthuser(authuser) {
  try {
    // Try My Account endpoint
    const response = await fetch(`https://myaccount.google.com/profile?authuser=${authuser}`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      return null;
    }
    
    const responseText = await response.text();
    
    // Look for email in the response
    const emailMatch = responseText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    
    if (emailMatch) {
      console.log(`Found email ${emailMatch[0]} for authuser ${authuser}`);
      return emailMatch[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error detecting email for authuser ${authuser}:`, error);
    return null;
  }
}

// Function to get the current active account from Google services
async function getCurrentActiveAccount() {
  try {
    console.log('Detecting current active account...');
    
    // Method 1: Use Google's endpoints to get accounts
    const identityAccounts = await getGoogleAccountsWithAuthuser();
    
    if (identityAccounts.length > 0) {
      // Method 1a: Try to detect which account is currently active
      const activeAccount = await detectActiveAccountFromIdentity(identityAccounts);
      if (activeAccount) {
        console.log(`Detected current active account from identity: ${activeAccount.email} (authuser: ${activeAccount.authuser})`);
        return activeAccount;
      }
      
      // Method 1b: If can't detect active, try to get it from Google My Account
      const response = await fetch('https://myaccount.google.com/profile', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const responseText = await response.text();
        const emailMatch = responseText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        
        if (emailMatch) {
          const email = emailMatch[0];
          const matchingAccount = identityAccounts.find(acc => acc.email === email);
          
          if (matchingAccount) {
            console.log(`Matched current active account: ${email} (authuser: ${matchingAccount.authuser})`);
            return matchingAccount;
          }
        }
      }
    }
    
    // Method 2: Fallback to old detection methods
    console.log('Falling back to alternative detection methods...');
    const pickerAccount = await getCurrentAccountFromPicker();
    if (pickerAccount) {
      console.log(`Detected current account from picker: ${pickerAccount.email} (authuser: ${pickerAccount.authuser})`);
      return pickerAccount;
    }
    
    console.log('Could not detect active account');
    return null;
  } catch (error) {
    console.error('Error getting current active account:', error);
    return null;
  }
}

// Function to detect which account is currently active from Chrome Identity accounts
async function detectActiveAccountFromIdentity(identityAccounts) {
  try {
    // Try to detect the active account by checking which one is being used
    for (const account of identityAccounts) {
      try {
        const response = await fetch(`https://myaccount.google.com/profile?authuser=${account.authuser}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const responseText = await response.text();
          const emailPattern = new RegExp(account.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          
          if (emailPattern.test(responseText)) {
            // This account is accessible, likely the active one
            return account;
          }
        }
      } catch (error) {
        // Continue to next account
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting active account from identity:', error);
    return null;
  }
}

// Function to get current account from Google account picker
async function getCurrentAccountFromPicker() {
  try {
    const response = await fetch('https://accounts.google.com/AccountChooser', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      return null;
    }
    
    const responseText = await response.text();
    
    // Look for the currently selected account
    const currentAccountMatch = responseText.match(/"current":\s*true[^}]*"email":\s*"([^"]+)"[^}]*"authuser":\s*"?(\d+)"?/i) ||
                               responseText.match(/"email":\s*"([^"]+)"[^}]*"current":\s*true[^}]*"authuser":\s*"?(\d+)"?/i);
    
    if (currentAccountMatch) {
      return {
        email: currentAccountMatch[1],
        authuser: parseInt(currentAccountMatch[2])
      };
    }
    
    // Alternative: look for active account indicators
    const activeAccountMatch = responseText.match(/data-active="true"[^>]*data-email="([^"]+)"[^>]*data-authuser="(\d+)"/i) ||
                              responseText.match(/data-email="([^"]+)"[^>]*data-active="true"[^>]*data-authuser="(\d+)"/i);
    
    if (activeAccountMatch) {
      return {
        email: activeAccountMatch[1],
        authuser: parseInt(activeAccountMatch[2])
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current account from picker:', error);
    return null;
  }
}

// Function to detect authuser from authentication context
async function detectAuthuserFromAuthContext(email) {
  try {
    console.log(`Detecting authuser from auth context for: ${email}`);
    
    // Method 1: Check Google's OAuth endpoints
    const oauthResponse = await fetch('https://accounts.google.com/oauth/authorize?client_id=dummy&response_type=code&scope=email&redirect_uri=http://localhost', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (oauthResponse.ok) {
      const oauthText = await oauthResponse.text();
      const emailPattern = new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      
      if (emailPattern.test(oauthText)) {
        // Look for authuser in the OAuth response
        const authuserMatch = oauthText.match(/authuser[=:](\d+)/i);
        if (authuserMatch) {
          return parseInt(authuserMatch[1]);
        }
      }
    }
    
    // Method 2: Check current session cookies for account hints
    const cookies = await new Promise((resolve) => {
      chrome.cookies.getAll({
        domain: '.google.com',
        name: 'ACCOUNT_CHOOSER'
      }, resolve);
    });
    
    for (const cookie of cookies) {
      try {
        const cookieValue = decodeURIComponent(cookie.value);
        const emailPattern = new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        
        if (emailPattern.test(cookieValue)) {
          // Look for authuser in cookie value
          const authuserMatch = cookieValue.match(/authuser[=:](\d+)/i);
          if (authuserMatch) {
            return parseInt(authuserMatch[1]);
          }
        }
      } catch (e) {
        // Ignore cookie parsing errors
      }
    }
    
    // Method 3: Try to find the account in Google's service endpoints
    for (let i = 0; i < 10; i++) {
      try {
        const testResponse = await fetch(`https://accounts.google.com/ListAccounts?authuser=${i}`, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (testResponse.ok) {
          const testText = await testResponse.text();
          const emailPattern = new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          
          if (emailPattern.test(testText)) {
            // Check if this authuser corresponds to our email
            const accountMatch = testText.match(new RegExp(`"email"\\s*:\\s*"${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*"authuser"\\s*:\\s*"?(\\d+)"?`, 'i'));
            if (accountMatch) {
              return parseInt(accountMatch[1]);
            }
            // If found in this authuser context, it's likely the correct one
            return i;
          }
        }
      } catch (e) {
        // Continue to next authuser
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting authuser from auth context:', error);
    return null;
  }
}

// Function to validate all stored accounts and fix invalid authuser values
async function validateAndFixStoredAccounts() {
  try {
    console.log('Validating stored accounts...');
    const accounts = await getStoredAccounts();
    let hasChanges = false;
    
    // Get the current Google accounts to validate against
    const identityAccounts = await getGoogleAccountsWithAuthuser();
    console.log('Current Google accounts for validation:', identityAccounts);
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      console.log(`Validating account: ${account.email} (authuser: ${account.authuser})`);
      
      // Find the account in Chrome Identity accounts
      const identityAccount = identityAccounts.find(idAcc => idAcc.email === account.email);
      
      if (identityAccount) {
        // Check if the stored authuser matches the identity authuser
        if (account.authuser !== identityAccount.authuser) {
          console.log(`Account ${account.email} authuser mismatch: stored=${account.authuser}, identity=${identityAccount.authuser}`);
          account.authuser = identityAccount.authuser;
          hasChanges = true;
        } else {
          console.log(`Account ${account.email} authuser ${account.authuser} is correct`);
        }
        
        // Remove inactive flag if it exists
        if (account.inactive) {
          delete account.inactive;
          hasChanges = true;
        }
      } else {
        console.log(`Account ${account.email} not found in Chrome Identity accounts, checking if it's still valid...`);
        
        // Account not found in identity, check if it's still accessible
        const isCurrentValid = await validateAuthuser(account.authuser, account.email);
        
        if (!isCurrentValid) {
          console.log(`Account ${account.email} is no longer valid, marking as inactive`);
          account.inactive = true;
          hasChanges = true;
        } else {
          console.log(`Account ${account.email} is still valid but not in identity list`);
        }
      }
    }
    
    // Save changes if any were made
    if (hasChanges) {
      await storeAccounts(accounts);
      cachedAccounts = accounts;
      lastAccountFetch = Date.now();
      console.log('Updated account authuser values');
    }
    
    return accounts;
  } catch (error) {
    console.error('Error validating stored accounts:', error);
    return await getStoredAccounts(); // Return current accounts if validation fails
  }
}

// Function to sync stored accounts with Chrome Identity API
async function syncStoredAccountsWithIdentity() {
  try {
    console.log('Syncing stored accounts with Chrome Identity API...');
    
    const [storedAccounts, identityAccounts] = await Promise.all([
      getStoredAccounts(),
      getGoogleAccountsWithAuthuser()
    ]);
    
    console.log('Stored accounts:', storedAccounts);
    console.log('Identity accounts:', identityAccounts);
    
    let hasChanges = false;
    const syncReport = {
      updated: [],
      removed: [],
      added: []
    };
    
    // Update existing accounts with correct authuser values
    for (const storedAccount of storedAccounts) {
      const identityAccount = identityAccounts.find(idAcc => idAcc.email === storedAccount.email);
      
      if (identityAccount) {
        if (storedAccount.authuser !== identityAccount.authuser) {
          console.log(`Updating ${storedAccount.email}: authuser ${storedAccount.authuser} -> ${identityAccount.authuser}`);
          storedAccount.authuser = identityAccount.authuser;
          syncReport.updated.push({
            email: storedAccount.email,
            oldAuthuser: storedAccount.authuser,
            newAuthuser: identityAccount.authuser
          });
          hasChanges = true;
        }
        
        // Remove inactive flag if it exists
        if (storedAccount.inactive) {
          delete storedAccount.inactive;
          hasChanges = true;
        }
      } else {
        console.log(`Account ${storedAccount.email} not found in identity, marking as inactive`);
        storedAccount.inactive = true;
        syncReport.removed.push(storedAccount.email);
        hasChanges = true;
      }
    }
    
    // Save changes if any were made
    if (hasChanges) {
      await storeAccounts(storedAccounts);
      cachedAccounts = storedAccounts;
      lastAccountFetch = Date.now();
      console.log('Sync completed with changes');
    } else {
      console.log('Sync completed - no changes needed');
    }
    
    return {
      success: true,
      accounts: storedAccounts,
      report: syncReport
    };
  } catch (error) {
    console.error('Error syncing with identity:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to get stored accounts from cache
async function getStoredAccounts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['accounts'], (result) => {
      const accounts = result.accounts || [];
      console.log('Stored accounts:', accounts);
      resolve(accounts);
    });
  });
}

// Function to store accounts in cache
async function storeAccounts(accounts) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ accounts: accounts }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error storing accounts:', chrome.runtime.lastError);
        resolve(false);
      } else {
        console.log('Accounts stored successfully');
        resolve(true);
      }
    });
  });
}



// Function to add a new Google account using Chrome Identity API
async function addGoogleAccount() {
  try {
    // Use launchWebAuthFlow for web-based OAuth
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
    const authUrl = 'https://accounts.google.com/o/oauth2/auth?' +
      'client_id=179898572754-489rcbhtfnjn0psrrqj1qe2kvp0g022t.apps.googleusercontent.com&' +
      'response_type=token&' +
      'redirect_uri=' + encodeURIComponent(redirectUri) + '&' +
      'scope=' + encodeURIComponent('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    
    const redirectUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(redirectUrl);
        }
      });
    });

    if (!redirectUrl) {
      throw new Error('No redirect URL received');
    }

    // Extract access token from URL
    const urlParams = new URLSearchParams(redirectUrl.split('#')[1]);
    const accessToken = urlParams.get('access_token');
    
    if (!accessToken) {
      throw new Error('No access token found');
    }

    // Get user info
    const userInfo = await getUserInfo(accessToken);
    if (!userInfo) {
      throw new Error('Failed to get user info');
    }

    // Get existing accounts
    const existingAccounts = await getStoredAccounts();
    
    // Check if account already exists
    const accountExists = existingAccounts.find(acc => acc.email === userInfo.email);
    if (accountExists) {
      console.log('Account already exists:', userInfo.email);
      return { success: false, error: 'Account already exists', account: accountExists };
    }

    // Detect the actual authuser index for this account
    console.log(`Detecting authuser for new account: ${userInfo.email}`);
    
    // First, check if this is the current active account
    const currentActive = await getCurrentActiveAccount();
    console.log('Current active account:', currentActive);
    
    let finalAuthuser = null;
    
    if (currentActive && currentActive.email === userInfo.email && currentActive.authuser !== null) {
      finalAuthuser = currentActive.authuser;
      console.log(`Using authuser ${finalAuthuser} from current active account`);
    } else {
      // Try to detect the authuser specifically for this email
      console.log(`Current active account doesn't match or no authuser found, detecting specifically for ${userInfo.email}`);
      const detectedAuthuser = await detectCurrentAuthuser(userInfo.email);
      
      if (detectedAuthuser !== null) {
        finalAuthuser = detectedAuthuser;
        console.log(`Detected authuser ${finalAuthuser} for ${userInfo.email}`);
      } else {
        // Last resort: try to detect from the authentication flow itself
        console.log('Trying to detect authuser from authentication context...');
        const authContextAuthuser = await detectAuthuserFromAuthContext(userInfo.email);
        
        if (authContextAuthuser !== null) {
          finalAuthuser = authContextAuthuser;
          console.log(`Found authuser ${finalAuthuser} from auth context`);
        } else {
          // Final fallback with warning
          console.warn(`Could not detect authuser for ${userInfo.email}, using fallback index ${existingAccounts.length}`);
          finalAuthuser = existingAccounts.length;
        }
      }
    }
    
    // Create new account object
    const newAccount = {
      email: userInfo.email,
      name: userInfo.name || userInfo.email.split('@')[0],
      profilePicture: userInfo.picture,
      id: userInfo.id,
      index: existingAccounts.length,
      authuser: finalAuthuser,
      addedAt: Date.now(),
      verified: finalAuthuser !== null && finalAuthuser !== existingAccounts.length // Mark if authuser was properly detected
    };

    // Add to existing accounts
    const updatedAccounts = [...existingAccounts, newAccount];
    
    // Store updated accounts
    const stored = await storeAccounts(updatedAccounts);
    if (!stored) {
      throw new Error('Failed to store account');
    }

    // Update cached accounts
    cachedAccounts = updatedAccounts;
    lastAccountFetch = Date.now();
    
    // Always set new account as default
    chrome.storage.sync.set({
      defaultAccount: newAccount.index,
      defaultAuthuser: newAccount.authuser
    });
    
    return { success: true, account: newAccount };

  } catch (error) {
    console.error('Error adding Google account:', error);
    return { success: false, error: error.message };
  }
}

// Function to get current active account from a Google Meet URL
function getCurrentAccountFromURL(url) {
  const urlObj = new URL(url);
  const authuser = urlObj.searchParams.get('authuser');
  
  // If authuser is explicitly in URL, use it
  if (authuser !== null) {
    return parseInt(authuser);
  }
  
  // If no authuser parameter, we need to force redirect to ensure correct account
  // Return null to indicate we need to force the authuser parameter
  return null;
}

// Function to construct Google Meet URL with authuser parameter
function constructMeetURL(originalUrl, accountIndex) {
  const url = new URL(originalUrl);
  url.searchParams.set('authuser', accountIndex.toString());
  return url.toString();
}

// Function to get all stored Google accounts
async function getAllGoogleAccounts() {
  try {
    // If we have cached accounts and they're still valid, return them immediately
    if (cachedAccounts.length > 0 && (Date.now() - lastAccountFetch) < CACHE_DURATION) {
      return cachedAccounts;
    }
    
    // Get accounts from storage
    const storedAccounts = await getStoredAccounts();
    
    // Update cache
    cachedAccounts = storedAccounts;
    lastAccountFetch = Date.now();
    
    return storedAccounts;
  } catch (error) {
    console.error('Error in getAllGoogleAccounts:', error);
    return [];
  }
}

// Function to remove an account from storage
async function removeAccount(accountIndex) {
  try {
    const storedAccounts = await getStoredAccounts();
    
    if (accountIndex < 0 || accountIndex >= storedAccounts.length) {
      throw new Error('Invalid account index');
    }
    
    // Remove account from array
    const updatedAccounts = storedAccounts.filter((_, index) => index !== accountIndex);
    
    // Update only the index property (NOT authuser - keep original values)
    updatedAccounts.forEach((account, index) => {
      account.index = index;
      // DO NOT change account.authuser - it should remain the original Google account index
    });
    
    // Store updated accounts
    const stored = await storeAccounts(updatedAccounts);
    if (!stored) {
      throw new Error('Failed to store updated accounts');
    }
    
    // Update cache
    cachedAccounts = updatedAccounts;
    lastAccountFetch = Date.now();
    
    // If removed account was default, set first account as default
    chrome.storage.sync.get(['defaultAccount'], (result) => {
      if (result.defaultAccount === accountIndex) {
        if (updatedAccounts.length > 0) {
          chrome.storage.sync.set({
            defaultAccount: 0,
            defaultAuthuser: updatedAccounts[0].authuser
          });
        } else {
          chrome.storage.sync.remove(['defaultAccount', 'defaultAuthuser']);
        }
      } else if (result.defaultAccount > accountIndex) {
        // Adjust default account index if it was after the removed account
        chrome.storage.sync.set({
          defaultAccount: result.defaultAccount - 1
        });
      }
    });
    
    return { success: true, accounts: updatedAccounts };
  } catch (error) {
    console.error('Error removing account:', error);
    return { success: false, error: error.message };
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getAccounts') {
    console.log('Received getAccounts request');
    getAllGoogleAccounts().then(accounts => {
      console.log('Sending accounts response:', accounts);
      sendResponse({accounts: accounts});
    }).catch(error => {
      console.error('Error getting accounts:', error);
      sendResponse({accounts: [], error: error.message});
    });
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'addAccount') {
    console.log('Received addAccount request');
    addGoogleAccount().then(result => {
      console.log('Add account result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Error adding account:', error);
      sendResponse({success: false, error: error.message});
    });
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'removeAccount') {
    console.log('Received removeAccount request for index:', request.accountIndex);
    removeAccount(request.accountIndex).then(result => {
      console.log('Remove account result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Error removing account:', error);
      sendResponse({success: false, error: error.message});
    });
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'getDefaultAccount') {
    chrome.storage.sync.get(['defaultAccount'], (result) => {
      sendResponse({defaultAccount: result.defaultAccount || 0});
    });
    return true;
  }
  
  if (request.action === 'setDefaultAccount') {
    // Get the account from cached accounts to get the real authuser value
    const account = cachedAccounts[request.accountIndex];
    if (account) {
      const defaultAuthuser = account.authuser;
      
      chrome.storage.sync.set({
        defaultAccount: request.accountIndex,
        defaultAuthuser: defaultAuthuser
      }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({success: false, error: chrome.runtime.lastError.message});
        } else {
          sendResponse({success: true});
        }
      });
    } else {
      sendResponse({success: false, error: 'Account not found'});
    }
    return true;
  }
  
  if (request.action === 'checkAccountMismatch') {
    const currentAccount = getCurrentAccountFromURL(request.url);
    
    chrome.storage.sync.get(['defaultAccount', 'defaultAuthuser'], async (result) => {
      try {
        const defaultAccount = result.defaultAccount;
        const defaultAuthuser = result.defaultAuthuser;
        
        // If no default account is set, don't redirect
        if (defaultAccount === undefined || defaultAuthuser === undefined) {
          sendResponse({needsRedirect: false, reason: 'No default account set'});
          return;
        }
        
        // Get stored accounts to validate the default account
        const storedAccounts = await getStoredAccounts();
        const defaultAccountObj = storedAccounts.find(acc => acc.index === defaultAccount);
        
        if (!defaultAccountObj) {
          console.error('Default account not found in stored accounts');
          sendResponse({needsRedirect: false, reason: 'Default account not found'});
          return;
        }
        
        // Check if the default account's authuser is still valid
        const isDefaultValid = await validateAuthuser(defaultAuthuser, defaultAccountObj.email);
        
        if (!isDefaultValid) {
          console.warn(`Default account authuser ${defaultAuthuser} is invalid, attempting to fix...`);
          
          // Try to detect the correct authuser for the default account
          const newAuthuser = await detectCurrentAuthuser(defaultAccountObj.email);
          
          if (newAuthuser !== null) {
            console.log(`Found new authuser ${newAuthuser} for default account`);
            
            // Update the stored account
            defaultAccountObj.authuser = newAuthuser;
            await storeAccounts(storedAccounts);
            
            // Update the storage
            chrome.storage.sync.set({
              defaultAuthuser: newAuthuser
            });
            
            // Use the new authuser for redirection
            const redirectUrl = constructMeetURL(request.url, newAuthuser);
            sendResponse({
              needsRedirect: true,
              redirectUrl: redirectUrl,
              currentAccount: currentAccount,
              defaultAccount: newAuthuser,
              reason: 'Fixed invalid authuser'
            });
          } else {
            console.error('Could not fix invalid authuser for default account');
            sendResponse({needsRedirect: false, reason: 'Default account authuser invalid and cannot be fixed'});
          }
          return;
        }
        
        // Normal redirect logic
        const needsRedirect = currentAccount === null || currentAccount !== defaultAuthuser;
        
        if (needsRedirect) {
          const redirectUrl = constructMeetURL(request.url, defaultAuthuser);
          
          sendResponse({
            needsRedirect: true,
            redirectUrl: redirectUrl,
            currentAccount: currentAccount,
            defaultAccount: defaultAuthuser,
            reason: 'Account mismatch'
          });
        } else {
          sendResponse({needsRedirect: false, reason: 'Account matches'});
        }
      } catch (error) {
        console.error('Error in checkAccountMismatch:', error);
        sendResponse({needsRedirect: false, reason: 'Error occurred', error: error.message});
      }
    });
    return true;
  }
  
  if (request.action === 'findAuthuserForEmail') {
    console.log('Received findAuthuserForEmail request for:', request.email);
    
    // Look for the email in stored accounts
    getAllGoogleAccounts().then(accounts => {
      const account = accounts.find(acc => acc.email === request.email);
      
      if (account) {
        console.log(`Found account for email ${request.email}: authuser=${account.authuser}`);
        sendResponse({authuser: account.authuser});
      } else {
        console.log(`Account not found for email ${request.email}`);
        sendResponse({authuser: null});
      }
    }).catch(error => {
      console.error('Error finding authuser for email:', error);
      sendResponse({authuser: null});
    });
    
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'validateAccounts') {
    console.log('Received validateAccounts request');
    
    validateAndFixStoredAccounts().then(accounts => {
      console.log('Account validation completed');
      sendResponse({success: true, accounts: accounts});
    }).catch(error => {
      console.error('Error validating accounts:', error);
      sendResponse({success: false, error: error.message});
    });
    
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'syncWithIdentity') {
    console.log('Received syncWithIdentity request');
    
    syncStoredAccountsWithIdentity().then(result => {
      console.log('Identity sync completed');
      sendResponse(result);
    }).catch(error => {
      console.error('Error syncing with identity:', error);
      sendResponse({success: false, error: error.message});
    });
    
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'getActiveAccountsFromChooser') {
    console.log('Received getActiveAccountsFromChooser request');
    
    getActiveAccountsFromAccountChooser().then(accounts => {
      console.log('Active accounts from chooser:', accounts);
      sendResponse({success: true, accounts: accounts});
    }).catch(error => {
      console.error('Error getting active accounts from chooser:', error);
      sendResponse({success: false, error: error.message, accounts: []});
    });
    
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'testAccountChooserImplementation') {
    console.log('Received testAccountChooserImplementation request');
    
    testAccountChooserImplementation().then(result => {
      console.log('Account chooser test result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Error testing account chooser implementation:', error);
      sendResponse({success: false, error: error.message});
    });
    
    return true; // Will respond asynchronously
  }
});

// Test function for Account Chooser implementation
async function testAccountChooserImplementation() {
  console.log('Testing Account Chooser implementation...');
  
  const testResults = {
    success: true,
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };
  
  // Test 1: Basic Account Chooser endpoint access
  try {
    console.log('Test 1: Basic Account Chooser endpoint access');
    const accounts = await getActiveAccountsFromAccountChooser();
    testResults.tests.push({
      name: 'Basic Account Chooser endpoint access',
      passed: accounts !== null && Array.isArray(accounts),
      result: `Found ${accounts.length} accounts`,
      details: accounts
    });
    testResults.summary.total++;
    if (accounts !== null && Array.isArray(accounts)) {
      testResults.summary.passed++;
    } else {
      testResults.summary.failed++;
    }
  } catch (error) {
    testResults.tests.push({
      name: 'Basic Account Chooser endpoint access',
      passed: false,
      result: 'Error occurred',
      error: error.message
    });
    testResults.summary.total++;
    testResults.summary.failed++;
  }
  
  // Test 2: Cookie extraction fallback
  try {
    console.log('Test 2: Cookie extraction fallback');
    const cookieAccounts = await extractAccountsFromCookies();
    testResults.tests.push({
      name: 'Cookie extraction fallback',
      passed: cookieAccounts !== null && Array.isArray(cookieAccounts),
      result: `Found ${cookieAccounts.length} accounts from cookies`,
      details: cookieAccounts
    });
    testResults.summary.total++;
    if (cookieAccounts !== null && Array.isArray(cookieAccounts)) {
      testResults.summary.passed++;
    } else {
      testResults.summary.failed++;
    }
  } catch (error) {
    testResults.tests.push({
      name: 'Cookie extraction fallback',
      passed: false,
      result: 'Error occurred',
      error: error.message
    });
    testResults.summary.total++;
    testResults.summary.failed++;
  }
  
  // Test 3: Integration with existing system
  try {
    console.log('Test 3: Integration with existing system');
    const existingAccounts = await getGoogleAccountsWithAuthuser();
    testResults.tests.push({
      name: 'Integration with existing system',
      passed: existingAccounts !== null && Array.isArray(existingAccounts),
      result: `Found ${existingAccounts.length} accounts via integrated system`,
      details: existingAccounts
    });
    testResults.summary.total++;
    if (existingAccounts !== null && Array.isArray(existingAccounts)) {
      testResults.summary.passed++;
    } else {
      testResults.summary.failed++;
    }
  } catch (error) {
    testResults.tests.push({
      name: 'Integration with existing system',
      passed: false,
      result: 'Error occurred',
      error: error.message
    });
    testResults.summary.total++;
    testResults.summary.failed++;
  }
  
  // Test 4: Account validation
  try {
    console.log('Test 4: Account validation');
    const validationResult = await validateAndFixStoredAccounts();
    testResults.tests.push({
      name: 'Account validation',
      passed: validationResult !== null && Array.isArray(validationResult),
      result: `Validated ${validationResult.length} stored accounts`,
      details: validationResult
    });
    testResults.summary.total++;
    if (validationResult !== null && Array.isArray(validationResult)) {
      testResults.summary.passed++;
    } else {
      testResults.summary.failed++;
    }
  } catch (error) {
    testResults.tests.push({
      name: 'Account validation',
      passed: false,
      result: 'Error occurred',
      error: error.message
    });
    testResults.summary.total++;
    testResults.summary.failed++;
  }
  
  testResults.success = testResults.summary.failed === 0;
  console.log('Test summary:', testResults.summary);
  
  return testResults;
}