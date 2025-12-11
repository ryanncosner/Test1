document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('imageInput');
    const thresholdSlider = document.getElementById('threshold');
    const thresholdDisplay = document.getElementById('thresholdDisplay');
    const feedInput = document.getElementById('feed');
    const scaleInput = document.getElementById('scale');
    const generateBtn = document.getElementById('generateGcodeBtn');
    const downloadBtn = document.getElementById('downloadGcodeBtn');
    const copyBtn = document.getElementById('copyGcodeBtn');
    const originalPreview = document.getElementById('originalPreview');
    const pathCanvas = document.getElementById('pathCanvas');
    const gcodeOutput = document.getElementById('gcodeOutput');
    const gcodeOutputSection = document.getElementById('gcodeOutputSection');
    const pathCtx = pathCanvas.getContext('2d');
    
    let uploadedImage = null;
    let currentGCode = null;
    let imagePaths = [];

    // Update threshold display
    thresholdSlider.addEventListener('input', function() {
        thresholdDisplay.textContent = this.value;
    });

    // Handle image upload
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                uploadedImage = img;
                
                // Display original image
                originalPreview.innerHTML = '';
                originalPreview.appendChild(img.cloneNode());

                // Clear previous paths
                imagePaths = [];
                clearCanvas();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    function clearCanvas() {
        pathCtx.fillStyle = '#0f172a';
        pathCtx.fillRect(0, 0, pathCanvas.width, pathCanvas.height);
    }

    // Generate G-Code from image
    generateBtn.addEventListener('click', function() {
        if (!uploadedImage) {
            alert('Please upload an image first');
            return;
        }

        const threshold = parseInt(thresholdSlider.value);
        const feed = parseInt(feedInput.value);
        const scale = parseFloat(scaleInput.value);

        // Get edge points from image
        imagePaths = getImageEdges(uploadedImage, threshold);
        
        // Draw path preview
        drawPathPreview(imagePaths, scale);

        // Generate G-Code
        currentGCode = generateGCode(imagePaths, feed, scale);
        
        // Display G-Code
        gcodeOutput.value = currentGCode;
        gcodeOutputSection.style.display = 'block';

        downloadBtn.style.display = 'inline-block';
        copyBtn.style.display = 'inline-block';
    });

    // Get edge points from image using edge detection
    function getImageEdges(img, threshold) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and apply threshold
        const bw = [];
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
            bw[i/4] = gray > threshold ? 255 : 0;
        }

        // Extract contours/edges using simple edge detection
        const paths = [];
        const visited = new Set();
        
        for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
                const idx = y * canvas.width + x;
                const isEdge = isEdgePixel(bw, x, y, canvas.width);
                
                if (isEdge && !visited.has(idx)) {
                    const path = traceContour(bw, x, y, canvas.width, canvas.height, visited);
                    if (path.length > 5) { // Only keep meaningful paths
                        paths.push(path);
                    }
                }
            }
        }

        return paths;
    }

    function isEdgePixel(bw, x, y, width) {
        const center = bw[y * width + x];
        const neighbors = [
            bw[(y-1) * width + x],
            bw[(y+1) * width + x],
            bw[y * width + (x-1)],
            bw[y * width + (x+1)]
        ];
        
        return neighbors.some(n => n !== center);
    }

    function traceContour(bw, startX, startY, width, height, visited) {
        const path = [];
        const directions = [
            [0, -1], [1, -1], [1, 0], [1, 1],
            [0, 1], [-1, 1], [-1, 0], [-1, -1]
        ];
        
        let x = startX, y = startY;
        let dirIdx = 0;
        let steps = 0;
        const maxSteps = 10000;

        while (steps < maxSteps) {
            steps++;
            visited.add(y * width + x);
            path.push({x, y});

            let found = false;
            for (let i = 0; i < 8; i++) {
                const dir = directions[(dirIdx + i) % 8];
                const nx = x + dir[0];
                const ny = y + dir[1];

                if (nx > 0 && nx < width && ny > 0 && ny < height) {
                    const idx = ny * width + nx;
                    if (isEdgePixel(bw, nx, ny, width) && !visited.has(idx)) {
                        x = nx;
                        y = ny;
                        dirIdx = (dirIdx + i) % 8;
                        found = true;
                        break;
                    }
                }
            }

            if (!found) break;
        }

        return path;
    }

    function drawPathPreview(paths, scale) {
        clearCanvas();

        if (paths.length === 0) {
            pathCtx.fillStyle = '#666';
            pathCtx.fillText('No paths detected. Try adjusting threshold.', 10, 20);
            return;
        }

        pathCtx.strokeStyle = '#6366f1';
        pathCtx.lineWidth = 1;
        pathCtx.fillStyle = 'transparent';

        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        paths.forEach(path => {
            path.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
        });

        const padding = 20;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const scaleX = (pathCanvas.width - 40) / width;
        const scaleY = (pathCanvas.height - 40) / height;
        const s = Math.min(scaleX, scaleY);

        // Draw paths
        paths.forEach(path => {
            pathCtx.beginPath();
            let first = true;
            path.forEach(p => {
                const x = (p.x - minX + padding) * s + 20;
                const y = (p.y - minY + padding) * s + 20;
                if (first) {
                    pathCtx.moveTo(x, y);
                    first = false;
                } else {
                    pathCtx.lineTo(x, y);
                }
            });
            pathCtx.stroke();
        });
    }

    function generateGCode(paths, feed, scale) {
        let gcode = '';
        gcode += '; G-Code Generated from Image\n';
        gcode += 'G21        ; Use millimeters\n';
        gcode += 'G90        ; Absolute positioning\n';
        gcode += 'F' + feed + ' ; Set feed rate\n\n';

        // Calculate bounds for centering
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        paths.forEach(path => {
            path.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
        });

        const centerX = (maxX + minX) / 2;
        const centerY = (maxY + minY) / 2;

        gcode += 'G0 Z5      ; Raise tool\n';
        gcode += 'G0 X0 Y0   ; Move to origin\n\n';

        paths.forEach((path, pathIdx) => {
            gcode += '; Path ' + (pathIdx + 1) + '\n';
            let first = true;

            path.forEach((p, idx) => {
                const x = (p.x - centerX) * scale / 10;
                const y = (p.y - centerY) * scale / 10;
                
                if (first) {
                    gcode += 'G0 X' + x.toFixed(2) + ' Y' + y.toFixed(2) + '\n';
                    gcode += 'G0 Z-2\n';
                    first = false;
                } else {
                    gcode += 'G1 X' + x.toFixed(2) + ' Y' + y.toFixed(2) + '\n';
                }
            });

            gcode += 'G0 Z5      ; Raise tool\n\n';
        });

        gcode += 'G0 X0 Y0   ; Return to origin\n';
        gcode += 'M5         ; Stop spindle\n';
        gcode += 'M30        ; End program\n';

        return gcode;
    }

    // Download G-Code
    downloadBtn.addEventListener('click', function() {
        if (!currentGCode) return;

        const blob = new Blob([currentGCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'design.gcode';
        link.click();
        URL.revokeObjectURL(url);
    });

    // Copy to clipboard
    copyBtn.addEventListener('click', function() {
        gcodeOutput.select();
        document.execCommand('copy');
        
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    });
});
