// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/*
  Content-scripts do not support ESM imports.
  However, by adding additional scripts to the content_scripts section in the 
  manifest.json, you can globaly include other scripts.
  The ordering of the files in content_scripts determines the order of the loading.

  We list the following 'imports' to show what we're bringing in globally from an
  previously loaded script:
  
  import { ExtensionControl } from './control.js';

*/

const CHECKMARK_URL = chrome.runtime.getURL("icons/checkmark.svg");
const INVALID_URL = chrome.runtime.getURL("icons/invalid.svg");
const WARNING_URL = chrome.runtime.getURL("icons/warning.svg");
const PATTERN = /uwa:\/\/\S+/g;


// Walks a node tree matching nodes containing specific text
// Returns array of nodes that match.
function findElementsWithText(element, pattern) {
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                return pattern.test(node.textContent)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP;
            },
        },
        false
    );

    const nodes = [];
    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }

    return nodes;
}

// Wait for new nodes to be added to the DOM. Scans new nodes that match the
// regular-expression. Returns an array of node that match.
function observe(pattern, callback) {

    const config = { attributes: false, childList: true, subtree: true };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver((mutationsList, observer) => {

        let matchingNodes = [];

        for (const mutation of mutationsList) {
            // For each new node
            // Walk its children and return all nodes with the matching text
            mutation.addedNodes.forEach(node => {
                matchingNodes = matchingNodes.concat(findElementsWithText(node, pattern));
            });

        }

        callback(matchingNodes);
    });

    // Start observing the target node for configured mutations
    observer.observe(document.body, config);

    // disconnect when we navigate away or close
    window.addEventListener("beforeunload", function (event) {
        observer.disconnect();
    });
}

// Start the observer, and process all nodes with text matching the pattern
observe(PATTERN, (nodes) => {

    nodes.forEach(node => {

        // Replace the search text
        node.textContent = node.textContent.replace(PATTERN, ' ');

        // Clone the icon to create a new instance
        const icon = iconWarning.cloneNode();

        // Create a custom control that appears when the icon is clicked
        new ExtensionControl('custom-control', icon);

        // Insert the new node after the existing node
        node.after(icon);

    });

});


// Create an instance of an image element
const icon = (path) => {
    const img = document.createElement('img');
    img.style.height = "1em";
    img.style.width = "1em";
    img.setAttribute("src", path);
    return img;
}


// Create an instance of each icon
const iconCheck = icon(CHECKMARK_URL);
const iconInvalid = icon(INVALID_URL);
const iconWarning = icon(WARNING_URL);




// Keeping this code around for future reference
() => {
    console.log("content.js loaded");
    console.log("Current URL:", window.location.href);

    currentUrl = window.location.href.split('/').slice(-2).join('/').replace(".html", "");
    console.log("currentUrl", currentUrl);

    // That code works on my sample html 
    let strings = document.body.innerHTML.match(/uwa:\/\/\S+/g);
    if (strings) {
        strings.forEach(string => {
            console.log(string);
            chrome.runtime.sendMessage({ text: "checkUWA", string: string }, uwaData => {
                if (uwaData) {
                    let BADGE_URL = CHECKMARK_URL;
                    let BADGE_TITLE = "Verified badge";

                    // check if web attestation is valid
                    if (uwaData.error) {
                        BADGE_URL = INVALID_URL;
                        BADGE_TITLE = "Invalid badge: " + uwaData.error;
                    } else {
                        if (uwaData.issuer !== "https://example.com/") {
                            // check if issuer is trusted
                            if (uwaData.issuer === "The Good Place") {
                                BADGE_URL = WARNING_URL;
                                BADGE_TITLE = "Untrusted badge issuer: (details)";
                            }

                            // check if scope is ok
                            const scope = uwaData.scope.split('/').slice(-2).join('/').replace(".html", "");
                            console.log("scope", scope);
                            if (currentUrl !== scope) {
                                BADGE_URL = INVALID_URL;
                                BADGE_TITLE = "Invalid badge: wrong scope";
                            }
                        }
                    }

                    let checkmarkImage = `<img src="${BADGE_URL}" alt="checkmark" width="50" title="
                ${BADGE_TITLE} &#013;
                Issued by: ${uwaData.issuer} &#013;
                Scope: ${uwaData.scope} &#013;
                Attached on: ${uwaData.date} &#013;
                Info: ${uwaData.info} &#013;
                "/>`;

                    console.log("checkmarkImage", checkmarkImage);
                    document.body.innerHTML = document.body.innerHTML.replace(string, checkmarkImage);
                } else {
                    // invalid web attestation, we won't render it
                }
            });
        });
    }
}
