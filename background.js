// Store certificates by host
const certificateCache = new Map();

// Listen for web requests to intercept security info
browser.webRequest.onHeadersReceived.addListener(
  async (details) => {
    if (details.url.startsWith('http:')) {
      // Try to upgrade to HTTPS
      try {
        const httpsUrl = details.url.replace('http:', 'https:');
        const tab = await browser.tabs.update(details.tabId, { url: httpsUrl });
        return { cancel: true };
      } catch (error) {
        console.error('Failed to upgrade to HTTPS:', error);
      }
    }
    
    if (details.url.startsWith('https:')) {
      try {
        const securityInfo = await browser.webRequest.getSecurityInfo(
          details.requestId,
          {
            certificateChain: true,
            rawDER: false
          }
        );
        
        if (securityInfo.certificates) {
          const host = new URL(details.url).hostname;
          certificateCache.set(host, securityInfo.certificates);
        }
      } catch (error) {
        console.error('Error getting security info:', error);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractCertificates') {
    extractCertificates(message.url)
      .then(certificates => sendResponse({ certificates }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep the message channel open for async response
  }
});

async function extractCertificates(url) {
  try {
    // First try to navigate to the URL to trigger certificate retrieval
    let tab;
    try {
      tab = await browser.tabs.create({ url, active: false });
    } catch (error) {
      throw new Error(`Failed to access URL: ${error.message}`);
    }
    
    // Wait a moment for the request to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const host = new URL(url).hostname;
    const certificates = certificateCache.get(host);
    
    // Close the tab we opened
    if (tab.id) {
      try {
        await browser.tabs.remove(tab.id);
      } catch (error) {
        console.error('Error closing tab:', error);
      }
    }
    
    if (!certificates) {
      throw new Error('No certificates found for this host');
    }
    
    return certificates.map(cert => {
      const certData = {
        subject: cert.subject,
        issuer: cert.issuer,
        validity: cert.validity ? {
          start: cert.validity.start,
          end: cert.validity.end
        } : null,
        fingerprint: cert.fingerprint ? {
          sha1: cert.fingerprint.sha1,
          sha256: cert.fingerprint.sha256
        } : null,
        serialNumber: cert.serialNumber
      };

      // Only include subjectPublicKeyInfo if it exists
      if (cert.subjectPublicKeyInfo) {
        certData.subjectPublicKeyInfo = {
          algorithm: cert.subjectPublicKeyInfo.algorithm,
          keyLength: cert.subjectPublicKeyInfo.keyLength
        };
      }

      return certData;
    });
  } catch (error) {
    throw error;
  }
}