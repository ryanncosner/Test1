document.addEventListener('DOMContentLoaded', function() {
    const qrInput = document.getElementById('qrInput');
    const qrSize = document.getElementById('qrSize');
    const qrColor = document.getElementById('qrColor');
    const qrBg = document.getElementById('qrBg');
    const sizeDisplay = document.getElementById('sizeDisplay');
    const generateBtn = document.getElementById('generateBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const qrContainer = document.getElementById('qrContainer');
    let currentQRCode = null;

    // Update size display
    qrSize.addEventListener('input', function() {
        sizeDisplay.textContent = this.value + 'px';
    });

    // Generate QR Code
    generateBtn.addEventListener('click', function() {
        const text = qrInput.value.trim();
        
        if (!text) {
            alert('Please enter some text or a URL');
            return;
        }

        // Clear previous QR code
        qrContainer.innerHTML = '';
        currentQRCode = null;

        // Create new QR code
        const size = parseInt(qrSize.value);
        const darkColor = qrColor.value;
        const lightColor = qrBg.value;

        currentQRCode = new QRCode(qrContainer, {
            text: text,
            width: size,
            height: size,
            colorDark: darkColor,
            colorLight: lightColor,
            correctLevel: QRCode.CorrectLevel.H
        });

        downloadBtn.style.display = 'inline-block';
    });

    // Download QR Code
    downloadBtn.addEventListener('click', function() {
        if (!currentQRCode) return;

        const canvas = qrContainer.querySelector('canvas');
        if (!canvas) {
            // If QRCode library rendered SVG, convert it
            const link = document.createElement('a');
            link.href = '#';
            link.download = 'qrcode.png';
            
            // Use html2canvas or create canvas from SVG
            const svg = qrContainer.querySelector('svg');
            if (svg) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const svgString = new XMLSerializer().serializeToString(svg);
                const img = new Image();
                const blob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                
                img.onload = function() {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    URL.revokeObjectURL(url);
                };
                img.src = url;
            }
            return;
        }

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'qrcode.png';
        link.click();
    });

    // Allow Enter key to generate
    qrInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            generateBtn.click();
        }
    });
});
