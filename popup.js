const urlInput = document.getElementById('urlInput');
const resultDiv = document.getElementById('result');
const extractBtn = document.getElementById('extractBtn');
const copyBtn = document.getElementById('copyBtn');
const exportBtn = document.getElementById('exportBtn');
const toggleDark = document.getElementById('toggleDark');
const exportFormat = document.getElementById('exportFormat');
const loadingContainer = document.getElementById('loadingContainer');

resultDiv.className = ''; 
resultDiv.style.display = 'none';

let lastFormattedText = '';
window.lastCertificateData = null;

// Load dark mode from localStorage
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-mode');
  toggleDark.classList.remove('light');
  toggleDark.textContent = '☀️';
}

// Extract button click
extractBtn.addEventListener('click', extract);

// Enter key triggers extraction
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') extract();
});

// Toggle dark mode
toggleDark.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  toggleDark.classList.toggle('light');
  toggleDark.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Copy result
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(resultDiv.textContent || '')
    .then(() => alert('Copied to clipboard!'))
    .catch(() => alert('Failed to copy!'));
});

// Export
exportBtn.addEventListener('click', () => {
  if (!window.lastCertificateData || !lastFormattedText) {
    alert('No data to export');
    return;
  }

  const format = exportFormat.value;
  let blob, filename;

  if (format === 'json') {
    blob = new Blob([JSON.stringify(window.lastCertificateData, null, 2)], { type: 'application/json' });
    filename = 'certificates.json';
  } else {
    blob = new Blob([lastFormattedText], { type: 'text/plain' });
    filename = 'certificates.txt';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
});

// Main extract function
async function extract() {
  const urlText = urlInput.value.trim();
  if (!urlText) {
    showMessage('Please enter a URL', 'yellow');
    return;
  }

  const url = urlText.startsWith('http') ? urlText : `https://${urlText}`;
  showLoading(true);
  showMessage('', '');

  try {
    showMessage('Fetching certificates...', ''); 
    const response = await browser.runtime.sendMessage({
      action: 'extractCertificates',
      url: url
    });

    showLoading(false);

    if (response.error) {
      showMessage(`Error: ${response.error}`, 'red');
    } else if (response.certificates?.length > 0) {
      window.lastCertificateData = response.certificates;
      const formatted = formatCertificates(response.certificates);
      lastFormattedText = formatted;
      showMessage(formatted, 'green');
    } else {
      showMessage('No certificates found', 'yellow');
    }
  } catch (error) {
    showLoading(false);
    showMessage(`Error: ${error.message}`, 'red');
  }
}

function showMessage(text, colorClass) {
  const resultDiv = document.getElementById('result');
  resultDiv.textContent = text;
  resultDiv.className = colorClass;
  resultDiv.style.display = 'block';
  resultDiv.style.opacity = '0';
  setTimeout(() => resultDiv.style.opacity = '1', 10); 
  //resultDiv.className = colorClass;
  //resultDiv.textContent = text;
}

function showLoading(show) {
  loadingContainer.style.display = show ? 'block' : 'none';
}

// Format certs
function formatCertificates(certs) {
  if (!certs || certs.length === 0) return 'No certificates found';

  return certs.map((cert, index) => {
    let certInfo = `Certificate #${index + 1}:
Subject: ${cert.subject || 'N/A'}
Issuer: ${cert.issuer || 'N/A'}
Valid From: ${cert.validity ? new Date(cert.validity.start).toLocaleString() : 'N/A'}
Valid To: ${cert.validity ? new Date(cert.validity.end).toLocaleString() : 'N/A'}`;

    if (cert.fingerprint) {
      certInfo += `
Fingerprint (SHA-1): ${cert.fingerprint.sha1 || 'N/A'}
Fingerprint (SHA-256): ${cert.fingerprint.sha256 || 'N/A'}`;
    }

    if (cert.serialNumber) {
      certInfo += `\nSerial Number: ${cert.serialNumber}`;
    }

    if (cert.subjectPublicKeyInfo) {
      certInfo += `
Public Key Algorithm: ${cert.subjectPublicKeyInfo.algorithm || 'N/A'}
Public Key Size: ${cert.subjectPublicKeyInfo.keyLength || 'N/A'} bits`;
    }

    return certInfo + '\n------------------------------------';
  }).join('\n\n');
}
