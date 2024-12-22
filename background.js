console.debug("Go Link Plugin: Service worker loaded");

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    
    console.debug("Omnibox input entered:", text);
    console.debug("Disposition:", disposition);

    const key = text.trim();
    if (!key) {
        console.error("No keyword entered after 'go '.");
        return;
    }

    // Retrieve the golink2Url map from storage
    chrome.storage.sync.get(["golink2Url"], (result) => {
        const golink2Url = result.golink2Url || {};
        const targetUrl = golink2Url[key];

        if (targetUrl) {
            if (disposition === "currentTab") {
                // Update the current active tab
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs.length === 0) {
                        console.error("No active tab found.");
                        return;
                    }
                    chrome.tabs.update(tabs[0].id, { url: targetUrl }, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Error updating tab:", chrome.runtime.lastError.message);
                        } else {
                            console.log("Tab updated successfully to:", targetUrl);
                        }
                    });
                });
            } else if (disposition === "newForegroundTab") {
                // Open the URL in a new foreground tab
                chrome.tabs.create({ url: targetUrl }, (tab) => {
                    console.log("New foreground tab created:", tab);
                });
            } else if (disposition === "newBackgroundTab") {
                // Open the URL in a new background tab
                chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
                    console.log("New background tab created:", tab);
                });
            }
        }
    });
});


chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    chrome.storage.sync.get(["golink2Url"], (result) => {
    const golink2Url = result.golink2Url || {};
    const suggestions = Object.keys(golink2Url)
        .filter((storedKey) => storedKey.startsWith(text))
        .map((storedKey) => ({
            content: `${storedKey}`,
            description: `Redirect to ${storedKey}`
        }));

    suggest(suggestions);
    });
  });