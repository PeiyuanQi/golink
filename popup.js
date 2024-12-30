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
  
  // Fetch the current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs.length === 0) {
      currentUrlElement.textContent = "No active tab found.";
      return;
    }

    const currentTab = tabs[0];
    const currentTabUrl = currentTab.url;
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

        // Save the updated map back to storage
        chrome.storage.sync.set({ ["golink2Url"]: golink2Url, ["url2Golink"]: url2Golink }, () => {
          console.debug("glink %s -> %s saved in golink2Url and url2Golink successfully!", golinkValue, currentTabUrl);
          deleteButton.classList.remove("d-none"); // Show the delete button
          // Show success notice for saving
          showNoticeWithCountdown(
            noticeElement,
            countdownTimerElement
          );
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
          if (golink2Url && url2Golink) {
            if (deleteButton) {
              deleteButton.classList.add("d-none");
              console.debug("Delete button hidden.");
            } else {
              console.warn(`Delete button not found.`);
            }
          } else {
            console.warn("Not all keys were found for deletion.");
          }

          // Show success notice for deleting
          showNoticeWithCountdown(
            noticeElement,
            countdownTimerElement
          );
        });
      });
    });
  });
});
  

function showNoticeWithCountdown(noticeElement, countdownTimerElement, countdownSeconds = 3) {
  // Show the notice with the provided message
  noticeElement.classList.remove("d-none");

  // Initialize the countdown
  let countdown = countdownSeconds;
  countdownTimerElement.textContent = countdown;

  // Start the countdown timer
  const countdownInterval = setInterval(() => {
    countdown -= 1;
    countdownTimerElement.textContent = countdown;

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      window.close(); // Close the popup
    }
  }, 1000);
}
