console.debug('Go link plugin pop up!');

document.addEventListener("DOMContentLoaded", async () => {
  // uncomment for debugging
  // chrome.storage.sync.get(["golink2Url", "url2Golink"], (result) => {
  //   console.log('result');
  //   console.log(result);
  // });

  const inputElement = document.getElementById("url-input");
  const currentUrlElement = document.getElementById("current-url");
  const saveButton = document.getElementById("save-button");
  const deleteButton = document.getElementById("delete-button");
  const noticeElement = document.getElementById("ops-notice");
  const countdownTimerElement = document.getElementById("countdown-timer");
  const settingsButton = document.getElementById('settings-button');
  const linksList = document.getElementById('links-list');
  const linksListContainer = linksList.querySelector('.list-group');
  const searchInput = document.getElementById('search-input');
  
  let countdownIntervalId = null; // Variable to hold the interval ID
  let currentTabUrl = null; // Variable to store the current tab URL
  let allGoLinks = {}; // Store all links fetched from storage

  function showNoticeWithCountdown(countdownSeconds = 3) {
    // Clear any existing countdown interval first
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }

    // Show the notice with the provided message
    noticeElement.classList.remove("d-none");

    // Initialize the countdown
    let countdown = countdownSeconds;
    countdownTimerElement.textContent = countdown;

    // Start the countdown timer
    countdownIntervalId = setInterval(() => {
      countdown -= 1;
      countdownTimerElement.textContent = countdown;

      if (countdown <= 0) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null; // Clear the ID
        window.close(); // Close the popup
      }
    }, 1000);
  }

  // Function to clear the countdown and hide the notice
  function clearAutoCloseCountdown() {
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
      noticeElement.classList.add("d-none"); // Hide the notice as well
      console.debug("Auto-close countdown cancelled by user interaction.");
    }
  }

  // Add listeners to interactive elements to cancel the countdown
  inputElement.addEventListener('focus', clearAutoCloseCountdown);
  inputElement.addEventListener('keydown', clearAutoCloseCountdown);
  settingsButton.addEventListener('click', clearAutoCloseCountdown, true); // Use capture for settings button
  linksListContainer.addEventListener('click', clearAutoCloseCountdown, true); // Catch clicks within the list
  searchInput.addEventListener('input', clearAutoCloseCountdown); // Cancel on search input
  searchInput.addEventListener('focus', clearAutoCloseCountdown); // Cancel on search focus

  // Fetch the current tab URL and check for existing link
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs.length === 0) {
      currentUrlElement.textContent = "No active tab found.";
      return;
    }

    const currentTab = tabs[0];
    currentTabUrl = currentTab.url; // Store the URL in the accessible variable
    currentUrlElement.textContent = currentTabUrl;

    // Retrieve the "url2Golink" map from chrome.storage.sync
    chrome.storage.sync.get(["url2Golink"], (result) => {
      const url2Golink = result.url2Golink || {};

      if (url2Golink[currentTabUrl]) {
        inputElement.value = url2Golink[currentTabUrl];
        deleteButton.classList.remove("d-none"); // Show the delete button
      }
    });
  });

  // Function to save the link
  function saveLink() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error("No active tab to save.");
        return;
      }

      const currentTabUrl = tabs[0].url;
      const golinkValue = inputElement.value;

      if (golinkValue.trim() === "") {
        console.error("Input box cannot be empty.");
        return;
      }

      // Retrieve the existing "golink2Url" map and update it
      chrome.storage.sync.get(["golink2Url", "url2Golink"], (result) => {
        const golink2Url = result.golink2Url || {};
        const url2Golink = result.url2Golink || {};
        golink2Url[golinkValue] = currentTabUrl;
        url2Golink[currentTabUrl] = golinkValue;

        // Save both dictionaries
        chrome.storage.sync.set({ golink2Url, url2Golink }, () => {
          console.debug("Mappings updated: go %s -> %s", golinkValue, currentTabUrl);
          deleteButton.classList.remove("d-none");
          showNoticeWithCountdown();

          // Refresh the list if it's currently visible
          if (!linksList.classList.contains('d-none')) {
            populateLinksList();
          }
        });
      });
    });
  }

  // Save the input value for the current tab URL in the "golink2Url" map
  saveButton.addEventListener("click", saveLink);

  // Trigger save when Enter is pressed in the input box
  inputElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent default behavior
      saveLink();
    }
  });

  // Delete the alias for the current tab URL
  deleteButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.log("No active tab to delete.");
        return;
      }

      const currentTabUrl = tabs[0].url;

      // Retrieve the existing "golink2Url" "url2Golink" maps and delete the key
      chrome.storage.sync.get(["golink2Url", "url2Golink"], (result) => {
        const golink2Url = result.golink2Url || {};
        const url2Golink = result.url2Golink || {};

        // Delete the specified keys
        let golink2UrlDeleted = false;
        let url2GolinkDeleted = false;

        if (currentTabUrl in url2Golink) {
          const golink = url2Golink[currentTabUrl]
          delete url2Golink[currentTabUrl];
          golink2UrlDeleted = true;
          if (golink in golink2Url) {
            delete golink2Url[golink];
            url2GolinkDeleted = true;
          }
        }

        // Save the updated maps back to storage
        chrome.storage.sync.set({ ["golink2Url"]: golink2Url, ["url2Golink"]: url2Golink }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error saving updated maps:", chrome.runtime.lastError);
            return;
          }

          console.debug("Maps updated:", { ["golink2Url"]: golink2Url, ["url2Golink"]: url2Golink });

          // If both keys were deleted, hide the button
          if (golink2UrlDeleted && url2GolinkDeleted) {
            if (deleteButton) {
              deleteButton.classList.add("d-none");
              console.debug("Delete button hidden.");
            } else {
              console.warn(`Delete button not found.`);
            }
          } else {
            console.warn("Not all expected keys were found/deleted for the current URL.");
          }

          deleteButton.classList.add("d-none"); // Hide delete button after successful deletion
          console.debug("Delete button hidden after successful delete.");

          // Show success notice for deleting
          showNoticeWithCountdown();

          // Refresh the list if it's currently visible
          if (!linksList.classList.contains('d-none')) {
            populateLinksList();
          }
        });
      });
    });
  });

  // Function to render the links list based on provided data
  function renderLinksList(linksToRender) {
    linksListContainer.innerHTML = ''; // Clear existing content

    if (Object.keys(linksToRender).length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'list-group-item text-center text-muted py-3';
      // Adjust message based on whether a search is active
      emptyMessage.textContent = searchInput.value ? 'No matching go links found' : 'No go links saved yet';
      linksListContainer.appendChild(emptyMessage);
    } else {
      Object.entries(linksToRender).forEach(([golink, url]) => {
        const listItem = document.createElement('div');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center py-2';

        const linkInfo = document.createElement('div');
        linkInfo.className = 'd-flex flex-column';
        linkInfo.innerHTML = `
          <span class="fw-bold">go ${golink}</span>
          <small class="text-muted text-truncate">
            <a href="${url}" target="_blank" title="${url}">${url}</a>
          </small>
        `;

        const deleteBtnInList = document.createElement('button');
        deleteBtnInList.className = 'btn btn-sm btn-outline-danger';
        deleteBtnInList.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16" style="vertical-align: -0.125em;">
            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
          </svg>
        `;
        deleteBtnInList.setAttribute('aria-label', 'Delete link');
        deleteBtnInList.onclick = () => deleteLinkFromList(golink, url);

        listItem.appendChild(linkInfo);
        listItem.appendChild(deleteBtnInList);
        linksListContainer.appendChild(listItem);
      });
    }
  }

  // Function to populate the links list content (fetches data and stores it)
  function populateLinksList() {
    chrome.storage.sync.get(["golink2Url"], (result) => {
      console.log('Populating list. Retrieved golink2Url:', result.golink2Url);
      allGoLinks = result.golink2Url || {}; // Store fetched links
      filterAndRenderLinks(); // Initial render (potentially filtered)
    });
  }

  // Function to filter links based on search input and render
  function filterAndRenderLinks() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (!searchTerm) {
      renderLinksList(allGoLinks); // Render all if search is empty
      return;
    }

    const filteredLinks = Object.entries(allGoLinks)
      .filter(([golink, url]) => golink.toLowerCase().includes(searchTerm))
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});

    renderLinksList(filteredLinks);
  }

  // Add event listener for the search input
  searchInput.addEventListener('input', filterAndRenderLinks);

  // Function to delete a link from the list view itself
  function deleteLinkFromList(golink, url) {
    chrome.storage.sync.get(["golink2Url", "url2Golink"], (result) => {
      let golink2Url = result.golink2Url || {};
      let url2Golink = result.url2Golink || {};
      let changed = false;

      // 1. Delete the specific golink from golink2Url
      if (golink in golink2Url) {
        // Optional: Verify the URL matches, though the list provides it
        // if (golink2Url[golink] === url) { 
        delete golink2Url[golink];
        changed = true;
        // } else {
        //   console.warn(`Inconsistency detected: golink '${golink}' does not map to URL '${url}' in storage.`);
        // }
      } else {
        console.warn(`Go link '${golink}' not found in golink2Url during list delete.`);
      }

      // 2. Only delete from url2Golink if it points back to the deleted golink
      if (url in url2Golink && url2Golink[url] === golink) {
        delete url2Golink[url];
        changed = true; // Ensure we save even if only url2Golink changed (unlikely here)
      }

      // Only save and refresh if a change was actually made
      if (changed) {
        // Save the updated maps back to storage
        chrome.storage.sync.set({ golink2Url, url2Golink }, () => { // Save updated objects
          if (chrome.runtime.lastError) {
            console.error("Error saving updated maps:", chrome.runtime.lastError);
            // Optionally, revert local changes or handle error
            return;
          }

          console.debug("Maps updated after list deletion:", { golink2Url, url2Golink });

          // Re-fetch and render the list to ensure it's updated
          populateLinksList();

          // 3. Refined check: Hide main delete button ONLY if NO alias remains for the current tab URL
          chrome.storage.sync.get(["url2Golink"], (updatedResult) => { // Re-get latest url2Golink
             const latestUrl2Golink = updatedResult.url2Golink || {};
             if (!latestUrl2Golink[currentTabUrl]) { // Check if *any* mapping exists for current URL
                deleteButton.classList.add("d-none");
                console.debug("Main delete button hidden as no alias remains for the current tab URL after list deletion.");
             } else {
                // Keep it visible if another alias still points to the current URL
                deleteButton.classList.remove("d-none"); 
                console.debug("Main delete button remains visible as another alias exists for the current tab URL.");
             }
          });
        });
      } else {
         console.log("No changes made during list delete operation for", golink, url);
      }
    });
  }

  // Function to toggle visibility and populate the links list
  function showLinksList() {
    // Toggle visibility first
    linksList.classList.toggle('d-none');

    // If the list is now visible, populate it
    if (!linksList.classList.contains('d-none')) {
      populateLinksList();
    }
  }

  // Add click handler for settings button to toggle/show the list
  settingsButton.addEventListener('click', showLinksList);
});

