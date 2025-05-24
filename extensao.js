//╔═════════════════════════════════════════════╗
//║           ✨ Liedson / sudo ✨              ║
//║                                             ║
//║        📅 Data Atual: 15/05/2025            ║
//║        📝 Nome do Script: Novo Script       ║
//║                                             ║
//╚═════════════════════ 723 ═══════════════════╝

(function() {
    'use strict';
    
    let scale = 1;
    let offsetX = 0;
    let video;
    let controlPanel;
    let controlsVisible = true;
    let remoteStream = null;
    let peerConnection = null;
    let isHost = false;
    let roomId = null;
    
    // Configuração do servidor STUN para WebRTC
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    async function substituirCamera(videoSource, isRemote = false) {
        if (!isRemote) {
            video = document.createElement('video');
            video.src = videoSource;
            video.loop = true;
            video.muted = true;
            video.autoplay = true;
            await video.play();
        } else {
            video = document.createElement('video');
            video.srcObject = videoSource;
            video.muted = true;
            video.autoplay = true;
            await video.play();
        }
        
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        canvas.width = 640;
        canvas.height = 480;
        
        function desenharFrame() {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                let width = canvas.width * scale;
                let height = canvas.height * scale;
                let x = (canvas.width - width) / 2 + offsetX;
                let y = (canvas.height - height) / 2;
                ctx.drawImage(video, x, y, width, height);
            }
            requestAnimationFrame(desenharFrame);
        }
        
        desenharFrame();
        
        let stream = canvas.captureStream(30);
        navigator.mediaDevices.getUserMedia = async function(constraints) {
            return new Promise((resolve) => {
                resolve(stream);
            });
        };
        
        console.log("Câmera falsa ativada!");
        criarNotificacao("Câmera falsa ativada com sucesso!");
    }
    
    // Função para criar sala de redirecionamento
    async function criarSalaRedirecionamento() {
        roomId = Math.random().toString(36).substring(2, 15);
        isHost = true;
        
        // Criar o link
        const baseUrl = window.location.origin + window.location.pathname;
        const redirectLink = `${baseUrl}?room=${roomId}&mode=camera`;
        
        // Mostrar o link para o usuário
        mostrarLinkRedirecionamento(redirectLink);
        
        // Configurar WebRTC como host
        await configurarWebRTCHost();
        
        criarNotificacao("Sala criada! Compartilhe o link para conectar outro dispositivo.");
    }
    
    function mostrarLinkRedirecionamento(link) {
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '10001';
        
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = 'white';
        modalContent.style.padding = '30px';
        modalContent.style.borderRadius = '10px';
        modalContent.style.maxWidth = '500px';
        modalContent.style.textAlign = 'center';
        modalContent.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        
        const title = document.createElement('h2');
        title.textContent = '📱 Link de Redirecionamento';
        title.style.marginBottom = '20px';
        title.style.color = '#333';
        
        const instruction = document.createElement('p');
        instruction.textContent = 'Abra este link em outro dispositivo para usar sua câmera:';
        instruction.style.marginBottom = '15px';
        instruction.style.color = '#666';
        
        const linkInput = document.createElement('input');
        linkInput.value = link;
        linkInput.style.width = '100%';
        linkInput.style.padding = '10px';
        linkInput.style.border = '2px solid #ddd';
        linkInput.style.borderRadius = '5px';
        linkInput.style.marginBottom = '15px';
        linkInput.style.fontSize = '12px';
        linkInput.readOnly = true;
        
        const copyButton = document.createElement('button');
        copyButton.textContent = '📋 Copiar Link';
        estilizarBotao(copyButton, '#2196F3');
        copyButton.style.marginRight = '10px';
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '✖️ Fechar';
        estilizarBotao(closeButton, '#f44336');
        
        copyButton.addEventListener('click', () => {
            linkInput.select();
            document.execCommand('copy');
            criarNotificacao('Link copiado para a área de transferência!');
        });
        
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modalContent.appendChild(title);
        modalContent.appendChild(instruction);
        modalContent.appendChild(linkInput);
        modalContent.appendChild(copyButton);
        modalContent.appendChild(closeButton);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }
    
    // Configurar WebRTC como host (recebe vídeo)
    async function configurarWebRTCHost() {
        peerConnection = new RTCPeerConnection(configuration);
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Em um cenário real, você enviaria isso via servidor de sinalização
                console.log('ICE Candidate:', event.candidate);
            }
        };
        
        peerConnection.ontrack = (event) => {
            console.log('Recebendo stream remoto');
            remoteStream = event.streams[0];
            substituirCamera(remoteStream, true);
        };
        
        // Simular sinalização local (em produção, use um servidor WebSocket)
        window.addEventListener('message', async (event) => {
            if (event.data.type === 'offer' && event.data.roomId === roomId) {
                await peerConnection.setRemoteDescription(event.data.offer);
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                // Enviar resposta
                window.postMessage({
                    type: 'answer',
                    answer: answer,
                    roomId: roomId
                }, '*');
            }
            
            if (event.data.type === 'ice-candidate' && event.data.roomId === roomId) {
                await peerConnection.addIceCandidate(event.data.candidate);
            }
        });
    }
    
    // Configurar WebRTC como cliente (envia vídeo)
    async function configurarWebRTCCliente(roomId) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }, 
                audio: false 
            });
            
            peerConnection = new RTCPeerConnection(configuration);
            
            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
            });
            
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    // Enviar candidate
                    window.opener.postMessage({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        roomId: roomId
                    }, '*');
                }
            };
            
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            // Enviar offer
            window.opener.postMessage({
                type: 'offer',
                offer: offer,
                roomId: roomId
            }, '*');
            
            // Escutar resposta
            window.addEventListener('message', async (event) => {
                if (event.data.type === 'answer' && event.data.roomId === roomId) {
                    await peerConnection.setRemoteDescription(event.data.answer);
                }
            });
            
            // Mostrar preview da câmera
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.muted = true;
            video.style.width = '100%';
            video.style.maxWidth = '400px';
            video.style.borderRadius = '10px';
            
            document.body.innerHTML = '';
            document.body.style.display = 'flex';
            document.body.style.flexDirection = 'column';
            document.body.style.alignItems = 'center';
            document.body.style.justifyContent = 'center';
            document.body.style.minHeight = '100vh';
            document.body.style.backgroundColor = '#f0f0f0';
            document.body.style.fontFamily = 'Arial, sans-serif';
            
            const title = document.createElement('h1');
            title.textContent = '📹 Câmera Conectada';
            title.style.color = '#333';
            title.style.marginBottom = '20px';
            
            const status = document.createElement('p');
            status.textContent = 'Sua câmera está sendo transmitida para o dispositivo principal.';
            status.style.color = '#666';
            status.style.marginBottom = '20px';
            status.style.textAlign = 'center';
            
            document.body.appendChild(title);
            document.body.appendChild(status);
            document.body.appendChild(video);
            
            criarNotificacao('Câmera conectada com sucesso!');
            
        } catch (error) {
            console.error('Erro ao acessar câmera:', error);
            alert('Erro ao acessar a câmera. Verifique as permissões.');
        }
    }
    
    function criarControlPanel() {
        // Verificar se é modo câmera (dispositivo remoto)
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        const mode = urlParams.get('mode');
        
        if (mode === 'camera' && roomId) {
            // Dispositivo remoto - configurar como cliente
            configurarWebRTCCliente(roomId);
            return;
        }
        
        // Painel de controle principal
        controlPanel = document.createElement('div');
        controlPanel.style.position = 'fixed';
        controlPanel.style.top = '10px';
        controlPanel.style.right = '10px';
        controlPanel.style.padding = '15px';
        controlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        controlPanel.style.borderRadius = '10px';
        controlPanel.style.zIndex = '9999';
        controlPanel.style.display = 'flex';
        controlPanel.style.flexDirection = 'column';
        controlPanel.style.gap = '10px';
        controlPanel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
        controlPanel.style.minWidth = '250px';
        controlPanel.style.transition = 'all 0.3s ease';
        document.body.appendChild(controlPanel);
        
        // Título do painel
        const title = document.createElement('div');
        title.textContent = '🎬 Controle de Câmera Falsa';
        title.style.color = 'white';
        title.style.fontSize = '16px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.textAlign = 'center';
        title.style.borderBottom = '1px solid #555';
        title.style.paddingBottom = '8px';
        controlPanel.appendChild(title);
        
        // Seção de opções de vídeo
        const videoOptionsSection = document.createElement('div');
        videoOptionsSection.style.display = 'flex';
        videoOptionsSection.style.flexDirection = 'column';
        videoOptionsSection.style.gap = '8px';
        controlPanel.appendChild(videoOptionsSection);
        
        // Botão para selecionar arquivo de vídeo
        const fileButton = document.createElement('button');
        fileButton.textContent = '🎥 Selecionar Vídeo Local';
        estilizarBotao(fileButton, '#2196F3');
        fileButton.style.width = '100%';
        videoOptionsSection.appendChild(fileButton);
        
        let fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        fileButton.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                substituirCamera(url);
            }
        });
        
        // Botão para criar redirecionamento
        const redirectButton = document.createElement('button');
        redirectButton.textContent = '📱 Usar Câmera de Outro Dispositivo';
        estilizarBotao(redirectButton, '#FF9800');
        redirectButton.style.width = '100%';
        videoOptionsSection.appendChild(redirectButton);
        
        redirectButton.addEventListener('click', criarSalaRedirecionamento);
        
        // Seção de zoom
        const zoomSection = document.createElement('div');
        zoomSection.style.marginTop = '10px';
        controlPanel.appendChild(zoomSection);
        
        const zoomLabel = document.createElement('div');
        zoomLabel.textContent = `🔍 Zoom: ${Math.round(scale * 100)}%`;
        zoomLabel.style.color = 'white';
        zoomLabel.style.marginBottom = '5px';
        zoomSection.appendChild(zoomLabel);
        
        const zoomSlider = document.createElement('input');
        zoomSlider.type = 'range';
        zoomSlider.min = '50';
        zoomSlider.max = '200';
        zoomSlider.value = scale * 100;
        zoomSlider.style.width = '100%';
        zoomSlider.style.height = '8px';
        zoomSlider.style.cursor = 'pointer';
        zoomSection.appendChild(zoomSlider);
        
        zoomSlider.addEventListener('input', () => {
            scale = parseFloat(zoomSlider.value) / 100;
            zoomLabel.textContent = `🔍 Zoom: ${Math.round(scale * 100)}%`;
        });
        
        // Seção de movimentação horizontal
        const movementSection = document.createElement('div');
        movementSection.style.display = 'flex';
        movementSection.style.justifyContent = 'space-between';
        movementSection.style.marginTop = '10px';
        movementSection.style.gap = '10px';
        controlPanel.appendChild(movementSection);
        
        const leftButton = document.createElement('button');
        leftButton.textContent = '⬅️ Esquerda';
        estilizarBotao(leftButton, '#4CAF50');
        leftButton.style.flex = '1';
        movementSection.appendChild(leftButton);
        
        const rightButton = document.createElement('button');
        rightButton.textContent = 'Direita ➡️';
        estilizarBotao(rightButton, '#4CAF50');
        rightButton.style.flex = '1';
        movementSection.appendChild(rightButton);
        
        leftButton.addEventListener('click', () => moveCamera(-20));
        rightButton.addEventListener('click', () => moveCamera(20));
        
        // Botão para esconder/mostrar controles
        const toggleControlsWrapper = document.createElement('div');
        toggleControlsWrapper.style.textAlign = 'center';
        toggleControlsWrapper.style.marginTop = '10px';
        controlPanel.appendChild(toggleControlsWrapper);
        
        const toggleControlsButton = document.createElement('button');
        toggleControlsButton.textContent = '👁️ Esconder Controles';
        estilizarBotao(toggleControlsButton, '#FF5722');
        toggleControlsButton.style.width = '100%';
        toggleControlsButton.style.marginTop = '5px';
        toggleControlsWrapper.appendChild(toggleControlsButton);
        
        // Mini botão que aparece quando controles estão escondidos
        const miniButton = document.createElement('button');
        miniButton.textContent = '👁️';
        miniButton.style.position = 'fixed';
        miniButton.style.top = '10px';
        miniButton.style.right = '10px';
        miniButton.style.padding = '8px 12px';
        miniButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        miniButton.style.color = 'white';
        miniButton.style.border = 'none';
        miniButton.style.borderRadius = '5px';
        miniButton.style.cursor = 'pointer';
        miniButton.style.zIndex = '9999';
        miniButton.style.display = 'none';
        document.body.appendChild(miniButton);
        
        toggleControlsButton.addEventListener('click', () => {
            toggleControls(miniButton, toggleControlsButton);
        });
        
        miniButton.addEventListener('click', () => {
            toggleControls(miniButton, toggleControlsButton);
        });
        
        // Créditos
        const credits = document.createElement('div');
        credits.textContent = 'v5.0 by Brazuca';
        credits.style.color = '#aaa';
        credits.style.fontSize = '10px';
        credits.style.textAlign = 'center';
        credits.style.marginTop = '10px';
        controlPanel.appendChild(credits);
        
        // Adicionar suporte a teclas
        document.addEventListener('keydown', handleKeyboardControls);
    }
    
    function estilizarBotao(button, color) {
        button.style.padding = '8px 12px';
        button.style.backgroundColor = color;
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.transition = 'all 0.2s ease';
        
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = adjustBrightness(color, -30);
            button.style.transform = 'scale(1.05)';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = color;
            button.style.transform = 'scale(1)';
        });
        
        button.addEventListener('mousedown', () => {
            button.style.transform = 'scale(0.98)';
        });
        
        button.addEventListener('mouseup', () => {
            button.style.transform = 'scale(1.05)';
        });
    }
    
    function adjustBrightness(hex, percent) {
        hex = hex.replace('#', '');
        let r = parseInt(hex.substr(0, 2), 16);
        let g = parseInt(hex.substr(2, 2), 16);
        let b = parseInt(hex.substr(4, 2), 16);
        
        r = Math.max(0, Math.min(255, r + percent));
        g = Math.max(0, Math.min(255, g + percent));
        b = Math.max(0, Math.min(255, b + percent));
        
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    function toggleControls(miniButton, toggleButton) {
        if (controlsVisible) {
            controlPanel.style.transform = 'translateX(300px)';
            setTimeout(() => {
                controlPanel.style.display = 'none';
                miniButton.style.display = 'block';
            }, 300);
            toggleButton.textContent = '👁️ Mostrar Controles';
        } else {
            miniButton.style.display = 'none';
            controlPanel.style.display = 'flex';
            setTimeout(() => {
                controlPanel.style.transform = 'translateX(0)';
            }, 10);
            toggleButton.textContent = '👁️ Esconder Controles';
        }
        controlsVisible = !controlsVisible;
    }
    
    function moveCamera(amount) {
        offsetX += amount;
    }
    
    function handleKeyboardControls(e) {
        switch (e.key) {
            case 'ArrowLeft':
                moveCamera(-20);
                break;
            case 'ArrowRight':
                moveCamera(20);
                break;
            case 'ArrowUp':
                scale = Math.min(scale + 0.1, 2);
                if (controlPanel) {
                    const slider = controlPanel.querySelector('input[type="range"]');
                    const label = controlPanel.querySelector('div:contains("Zoom")');
                    if (slider) slider.value = scale * 100;
                    if (label) label.textContent = `🔍 Zoom: ${Math.round(scale * 100)}%`;
                }
                break;
            case 'ArrowDown':
                scale = Math.max(scale - 0.1, 0.5);
                if (controlPanel) {
                    const slider = controlPanel.querySelector('input[type="range"]');
                    const label = controlPanel.querySelector('div:contains("Zoom")');
                    if (slider) slider.value = scale * 100;
                    if (label) label.textContent = `🔍 Zoom: ${Math.round(scale * 100)}%`;
                }
                break;
            case 'h':
            case 'H':
                if (controlPanel && controlsVisible) {
                    const toggleButton = Array.from(controlPanel.querySelectorAll('button')).find(btn => 
                        btn.textContent.includes('Controles'));
                    const miniButton = document.querySelector('button[style*="position: fixed"][style*="right: 10px"]');
                    if (toggleButton && miniButton) toggleControls(miniButton, toggleButton);
                }
                break;
        }
    }
    
    function criarNotificacao(mensagem) {
        const notification = document.createElement('div');
        notification.textContent = mensagem;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = 'rgba(46, 125, 50, 0.9)';
        notification.style.color = 'white';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '10000';
        notification.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
        notification.style.fontWeight = 'bold';
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 100);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Inicializar interface
    criarControlPanel();
    
    // Mostrar dica inicial (apenas se não for modo câmera)
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('mode')) {
        setTimeout(() => {
            criarNotificacao("Use as setas do teclado para mover e dar zoom! Tecla H para esconder controles.");
        }, 1000);
    }
})();
