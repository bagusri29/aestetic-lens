document.addEventListener('DOMContentLoaded', () => {
    const imageLoader = document.getElementById('imageLoader');
    const outputCanvas = document.getElementById('output-canvas');
    const placeholderText = document.getElementById('placeholder-text');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const intensitySlider = document.getElementById('intensity-slider');
    const intensityVal = document.getElementById('intensity-val');
    const downloadBtn = document.getElementById('download-btn');

    let fxCanvas;
    let texture;
    let imageSource = new Image();
    let currentFilter = 'normal';
    let renderTimeout;
    
    // Inisialisasi ctx 2D untuk menjembatani WebGL dan Web Worker
    const ctx2D = outputCanvas.getContext('2d', { willReadFrequently: true });
    
    // Inisialisasi Web Worker
    const worker = new Worker('worker.js');

    try {
        fxCanvas = fx.canvas();
    } catch (e) {
        alert('Browser Anda tidak mendukung WebGL yang diperlukan untuk filter ini.');
    }

    const presets = {
        normal: { bc: [0, 0], hs: [0, 0], vignette: [0, 0], grain: 0 },
        cinematic: { bc: [0.05, 0.2], hs: [0, -0.2], vignette: [0.3, 0.7], grain: 15 },
        aesthetic: { bc: [0.1, 0.0], hs: [0.1, 0.3], sepia: 0.3, vignette: [0.2, 0.8], grain: 25 },
        protone: { bc: [-0.05, 0.15], hs: [0, 0.1], vignette: [0.1, 0.9], grain: 5 }
    };

    imageLoader.addEventListener('change', handleImage);
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            requestRender();
        });
    });

    intensitySlider.addEventListener('input', (e) => {
        intensityVal.textContent = e.target.value;
        // Debounce rendering untuk performa saat slider digeser
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(requestRender, 50); 
    });

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `AestheticLens_${Date.now()}.png`;
        link.href = outputCanvas.toDataURL();
        link.click();
    });

    function handleImage(e) {
        const reader = new FileReader();
        reader.onload = function(event) {
            imageSource.onload = function() {
                placeholderText.style.display = 'none';
                outputCanvas.style.display = 'block';
                downloadBtn.disabled = false;
                
                // Set resolusi canvas sesuai gambar
                outputCanvas.width = imageSource.width;
                outputCanvas.height = imageSource.height;
                
                if (texture) texture.destroy();
                texture = fxCanvas.texture(imageSource);
                
                requestRender();
            }
            imageSource.src = event.target.result;
        }
        if(e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
    }

    function requestRender() {
        if (!texture) return;

        const intensity = parseInt(intensitySlider.value) / 100;
        const preset = presets[currentFilter];

        // Pipeline 1: GPU Rendering dengan glfx.js
        fxCanvas.draw(texture);
        
        // Interpolasi parameter berdasarkan intensity (0 - 100%)
        const brightness = preset.bc[0] * intensity;
        const contrast = preset.bc[1] * intensity;
        const hue = preset.hs[0] * intensity;
        const saturation = preset.hs[1] * intensity;
        
        fxCanvas.brightnessContrast(brightness, contrast);
        fxCanvas.hueSaturation(hue, saturation);
        
        if (preset.sepia && intensity > 0) {
            fxCanvas.sepia(preset.sepia * intensity);
        }
        
        if (preset.vignette[0] > 0 && intensity > 0) {
            const size = 1.0 - (preset.vignette[0] * intensity);
            const amount = preset.vignette[1] * intensity;
            fxCanvas.vignette(size, amount);
        }

        fxCanvas.update();

        // Transfer hasil WebGL ke Canvas 2D
        ctx2D.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        ctx2D.drawImage(fxCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

        // Pipeline 2: Pemrosesan Piksel (Grain) dengan Web Worker
        const grainIntensity = preset.grain * intensity;
        if (grainIntensity > 0) {
            const imageData = ctx2D.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
            
            // Kirim ke worker
            worker.postMessage({
                imageData: imageData,
                grainAmount: grainIntensity
            });
        }
    }

    // Menerima hasil dari Web Worker dan melakukan repaint
    worker.onmessage = function(e) {
        const processedData = e.data.imageData;
        ctx2D.putImageData(processedData, 0, 0);
    };
});
