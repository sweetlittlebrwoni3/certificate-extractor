document.getElementById('extractBtn').addEventListener('click', async () => {
  const urlInput = document.getElementById('urlInput').value.trim();
  const resultDiv = document.getElementById('result');
  
  if (!urlInput) {
    resultDiv.textContent = 'Please enter a URL';
    return;
  }

  try {
    // Ensure the URL starts with https://
    const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
    
    resultDiv.textContent = 'Fetching certificates...';
    
    // Send message to background script
    const response = await browser.runtime.sendMessage({
      action: 'extractCertificates',
      url: url
    });
    
    if (response.error) {
      resultDiv.textContent = `Error: ${response.error}`;
    } else {
      resultDiv.textContent = formatCertificates(response.certificates);
    }
  } catch (error) {
    resultDiv.textContent = `Error: ${error.message}`;
  }
});

function formatCertificates(certs) {
  if (!certs || certs.length === 0) return 'No certificates found';
  
  return certs.map((cert, index) => {
    let certInfo = `Certificate #${index + 1}:
Subject: ${cert.subject || 'N/A'}
Issuer: ${cert.issuer || 'N/A'}
Valid From: ${cert.validity ? new Date(cert.validity.start).toLocaleString() : 'N/A'}
Valid To: ${cert.validity ? new Date(cert.validity.end).toLocaleString() : 'N/A'}`;

    // Add fingerprints if available
    if (cert.fingerprint) {
      certInfo += `
Fingerprint (SHA-1): ${cert.fingerprint.sha1 || 'N/A'}
Fingerprint (SHA-256): ${cert.fingerprint.sha256 || 'N/A'}`;
    }

    // Add serial number if available
    if (cert.serialNumber) {
      certInfo += `
Serial Number: ${cert.serialNumber}`;
    }

    // Add public key info if available
    if (cert.subjectPublicKeyInfo) {
      certInfo += `
Public Key Algorithm: ${cert.subjectPublicKeyInfo.algorithm || 'N/A'}
Public Key Size: ${cert.subjectPublicKeyInfo.keyLength || 'N/A'} bits`;
    }

    return certInfo + '\n------------------------------------';
  }).join('\n\n');
}