// Popup script for Google Meet Extension
document.addEventListener("DOMContentLoaded", function () {
  const contentDiv = document.getElementById("content");
  const errorDiv = document.getElementById("error");
  const loadingDiv = document.getElementById("loading");
  const accountsContainer = document.getElementById("accounts-container");
  const retryBtn = document.getElementById("retry-btn");

  let accounts = [];
  let defaultAccountIndex = 0;


  // Show content
  function showContent() {
    contentDiv.classList.remove("hidden");
    errorDiv.classList.add("hidden");
    loadingDiv.classList.add("hidden");
  }

  // Show error
  function showError() {
    contentDiv.classList.add("hidden");
    loadingDiv.classList.add("hidden");
    errorDiv.classList.remove("hidden");
  }

  // Show loading
  function showLoading() {
    contentDiv.classList.add("hidden");
    errorDiv.classList.add("hidden");
    loadingDiv.classList.remove("hidden");
  }

  // Create account item element
  function createAccountItem(account, index, isDefault) {
    const item = document.createElement("div");
    item.className = `account-item ${isDefault ? "selected" : ""}`;
    item.dataset.index = index;

    const email = document.createElement("div");
    email.className = "account-email";
    email.textContent = account.email;

    const indicator = document.createElement("div");
    indicator.className = `status-indicator ${isDefault ? "default" : ""}`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.innerHTML = "×";
    removeBtn.title = "Remove account";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeAccount(index);
    });

    item.appendChild(email);
    item.appendChild(indicator);

    item.addEventListener("click", () => {
      setDefaultAccount(index);
    });

    return item;
  }

  // Render accounts list
  function renderAccounts() {
    accountsContainer.innerHTML = "";

    accounts.forEach((account, arrayIndex) => {
      const item = createAccountItem(
        account,
        arrayIndex,
        arrayIndex === defaultAccountIndex
      );
      accountsContainer.appendChild(item);
    });
  }

  // Set default account
  function setDefaultAccount(index) {
    defaultAccountIndex = index;

    document.querySelectorAll(".account-item").forEach((item, i) => {
      item.classList.toggle("selected", i === index);
      const indicator = item.querySelector(".status-indicator");
      indicator.className = `status-indicator ${i === index ? "default" : ""}`;
    });

    chrome.runtime.sendMessage({
      action: "setDefaultAccount",
      accountIndex: index,
    });
  }


  // Load accounts without cache - always fresh
  function loadAccountsWithoutCache() {
    showLoading();
    const startTime = Date.now();
    
    refreshAccounts().then(() => {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsed);
      
      setTimeout(() => {
        if (accounts.length === 0) {
          showError();
        } else {
          loadDefaultAccountAndRender();
        }
      }, remainingTime);
    });
  }

  // Refresh accounts from browser session
  function refreshAccounts() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "refreshAccounts" }, (response) => {
        if (chrome.runtime.lastError || !response.success) {
          console.error(
            "Failed to refresh accounts:",
            chrome.runtime.lastError || response.error
          );
          resolve();
          return;
        }
        
        // Update accounts array with refreshed data
        accounts = response.accounts || [];
        resolve();
      });
    });
  }

  // Load default account and render
  function loadDefaultAccountAndRender() {
    if (accounts.length === 0) {
      showError();
      return;
    }

    chrome.runtime.sendMessage(
      { action: "getDefaultAccount" },
      (defaultResponse) => {
        if (chrome.runtime.lastError) {
          defaultAccountIndex = 0;
        } else if (defaultResponse) {
          defaultAccountIndex = defaultResponse.defaultAccount || 0;
          if (defaultAccountIndex >= accounts.length) {
            defaultAccountIndex = 0;
          }
        }

        renderAccounts();
        showContent();
      }
    );
  }

  // Event listeners
  retryBtn.addEventListener("click", () => {
    loadAccountsWithoutCache();
  });

  const startMeetBtn = document.getElementById("start-meet-btn");
  if (startMeetBtn) {
    startMeetBtn.addEventListener("click", () => {
      if (accounts.length > 0) {
        const authUserIndex = defaultAccountIndex;
        const meetUrl = `https://meet.google.com/new?authuser=${authUserIndex}`;
        chrome.tabs.create({ url: meetUrl });
      } else {
        alert("No accounts available to start Meet.");
      }
    });
  }

  // Initialize
  loadAccountsWithoutCache();
});
