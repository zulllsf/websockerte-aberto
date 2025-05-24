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
    let isHost = false; // Will be set in criarSalaRedirecionamento or configurarWebRTCCliente
    let roomId = null; // Will be set in criarSalaRedirecionamento or configurarWebRTCCliente
    let websocket = null; // WebSocket connection
    
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
        roomId = Math.random().toString(36).substring(2, 15); // Sets global roomId
        isHost = true; // This is the host
        
        const baseUrl = window.location.origin + window.location.pathname;
        const redirectLink = `${baseUrl}?room=${roomId}&mode=camera`;
        mostrarLinkRedirecionamento(redirectLink);

        websocket = new WebSocket('ws://localhost:8765');
        setupWebSocketEventHandlers(); // Setup global handlers for onmessage, onerror, onclose

        websocket.onopen = () => {
            console.log('Host WebSocket connected');
            sendMessage({ type: 'join' }); // sendMessage will add { room: roomId }
        };
        
        // Initialize RTCPeerConnection for the host
        peerConnection = new RTCPeerConnection(configuration);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Host: Sending ICE Candidate:', event.candidate);
                sendMessage({ type: 'ice-candidate', candidate: event.candidate });
            }
        };

        peerConnection.ontrack = (event) => {
            console.log('Host: Recebendo stream remoto');
            remoteStream = event.streams[0];
            // Ensure video element is created or updated for the remote stream
            substituirCamera(remoteStream, true); 
        };
        
        criarNotificacao("Sala criada! Compartilhe o link. Aguardando conexão do cliente...");
        // No longer calling configurarWebRTCHost()
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
    
    // The function configurarWebRTCHost is now removed. 
    // Its peerConnection setup is moved to criarSalaRedirecionamento.
    // Its message handling (offer, ice-candidate) is covered by global websocket.onmessage (handleWebSocketMessage).
    
    // Configurar WebRTC como cliente (envia vídeo)
    async function configurarWebRTCCliente(currentRoomIdFromUrl) { // Parameter name is specific
        roomId = currentRoomIdFromUrl; // Set the global roomId for the client
        isHost = false; // This is the client

        websocket = new WebSocket('ws://localhost:8765');
        setupWebSocketEventHandlers(); // Setup global handlers for onmessage, onerror, onclose

        websocket.onopen = () => {
            console.log('Client WebSocket connected');
            sendMessage({ type: 'join' }); // sendMessage will add { room: roomId }
        };
        
        // Offer creation is now deferred until 'room_full' message is received via WebSocket.

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
                    console.log('Client: Sending ICE Candidate:', event.candidate);
                    sendMessage({ type: 'ice-candidate', candidate: event.candidate });
                }
            };
            
            // REMOVED: Old offer creation and sending via postMessage
            // const offer = await peerConnection.createOffer();
            // await peerConnection.setLocalDescription(offer);
            // window.opener.postMessage(... offer ...);
            
            // REMOVED: Old event listener for answers via postMessage
            // window.addEventListener('message', async (event) => { ... answer ... });
            
            // Mostrar preview da câmera (UI setup)
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
        // Use local variables for URL parsing to avoid conflict with global roomId
        const localUrlParams = new URLSearchParams(window.location.search);
        const roomIdFromUrl = localUrlParams.get('room'); // Specific variable for URL param
        const modeFromUrl = localUrlParams.get('mode'); // Specific variable for URL param
        
        if (modeFromUrl === 'camera' && roomIdFromUrl) {
            // Dispositivo remoto - configurar como cliente
            configurarWebRTCCliente(roomIdFromUrl); // Pass the roomId from URL
            return; // Stop further execution for client page, as it has its own UI
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
    
    function criarNotificacao(mensagem, type = 'info') { // Added type parameter
        const notification = document.createElement('div');
        notification.textContent = mensagem;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        
        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = 'rgba(76, 175, 80, 0.9)'; // Brighter green
                break;
            case 'warning':
                notification.style.backgroundColor = 'rgba(255, 152, 0, 0.9)'; // Orange
                break;
            case 'error':
                notification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)'; // Red
                break;
            case 'info':
            default:
                notification.style.backgroundColor = 'rgba(46, 125, 50, 0.9)'; // Default green
                break;
        }
        
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
    
    // Helper function to send messages via WebSocket
    function sendMessage(payload) {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            // Ensure 'room' (not 'roomId') is part of the payload for the server
            const messageWithRoom = { ...payload, room: roomId };
            websocket.send(JSON.stringify(messageWithRoom));
            console.log('Sent message:', messageWithRoom);
        } else {
            console.error('WebSocket not connected or not open. Cannot send message:', payload);
        }
    }

    // Definition of the WebSocket message handler function
    // This function will be assigned to websocket.onmessage after websocket is initialized
    async function handleWebSocketMessage(event) {
        const message = JSON.parse(event.data);
        console.log('Received message:', message);

        // Allow join_ack, room_full, and error without strict room check initially, or if room is not set yet
        if (message.type !== 'join_ack' && message.type !== 'room_full' && message.type !== 'error' && message.room !== roomId) {
            console.warn(`Message for room ${message.room} ignored, current room is ${roomId}. Message type: ${message.type}`);
            return;
        }

        switch (message.type) {
            case 'join_ack':
                criarNotificacao(message.message || "Successfully joined room.", 'success');
                break;
            case 'room_full':
                if (!isHost && peerConnection) { // Client side
                    criarNotificacao("Participant connected! Initiating WebRTC call...", 'success');
                    console.log("Client: Room is full, creating offer.");
                    try {
                        const offer = await peerConnection.createOffer();
                        await peerConnection.setLocalDescription(offer);
                        sendMessage({ type: 'offer', offer: offer });
                    } catch (error) {
                        console.error("Client: Error creating offer:", error);
                        criarNotificacao("Error creating WebRTC offer.", 'error');
                    }
                } else if (isHost) {
                     criarNotificacao("Another participant joined. Waiting for their offer...", 'info');
                }
                break;
            case 'offer': // Host side
                if (isHost && peerConnection) {
                    console.log('Host: Received offer');
                    try {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);
                        sendMessage({ type: 'answer', answer: answer });
                    } catch (error) {
                        console.error("Host: Error processing offer or creating answer:", error);
                        criarNotificacao("Error processing WebRTC offer.", 'error');
                    }
                }
                break;
            case 'answer': // Client side
                if (!isHost && peerConnection) {
                    console.log('Client: Received answer');
                    try {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
                    } catch (error) {
                        console.error("Client: Error setting remote description from answer:", error);
                        criarNotificacao("Error processing WebRTC answer.", 'error');
                    }
                }
                break;
            case 'ice-candidate':
                if (peerConnection) {
                    console.log(`${isHost ? 'Host' : 'Client'}: Received ICE candidate`);
                    try {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
                    } catch (error) {
                        console.error(`${isHost ? 'Host' : 'Client'}: Error adding ICE candidate:`, error);
                    }
                }
                break;
            case 'peer_left':
                criarNotificacao("O outro participante desconectou.");
                console.log("Peer has left the room. Closing connection.");
                if (peerConnection) {
                    peerConnection.close();
                    peerConnection = null;
                }
                if (isHost) {
                    // Optionally, re-initialize host to wait for a new client
                    console.log("Host: Peer connection closed. User may need to re-create room.");
                    // UI could be updated to reflect that the host is now waiting again.
                    // For now, manual re-creation of room is expected.
                } else { // Client
                    document.body.innerHTML = '<div style="text-align: center; padding-top: 50px; font-family: sans-serif; font-size: 18px;">Connection closed. The other participant disconnected. You can close this window.</div>';
                }
                break;
            case 'error': // Error messages from server
                 criarNotificacao(`Server error: ${message.message}`, 'error');
                 console.error('Server error:', message.message);
                 break;
            default:
                console.log('Unknown message type received:', message.type);
        }
    }

    function setupWebSocketEventHandlers() {
        if (!websocket) {
            console.error("WebSocket object not initialized, cannot set up event handlers.");
            return;
        }

        websocket.onopen = () => {
            console.log("WebSocket connection established.");
            // The actual join message is sent from within criarSalaRedirecionamento or configurarWebRTCCliente's own onopen
            // This global onopen can be for a general "connected to signaling" notification if needed,
            // but specific join logic remains where it is to ensure it has correct context (roomId, isHost).
            // For now, the specific onopen handlers in host/client functions will provide join confirmation.
            // We can add a general success notification here if desired:
            criarNotificacao("Successfully connected to signaling server!", "success");
        };
        
        websocket.onmessage = handleWebSocketMessage; // Assign the async function

        websocket.onerror = (event) => {
            console.error("WebSocket error observed:", event);
            criarNotificacao("Error connecting to signaling server. Please check if the server is running and try again.", "error");
            // Potentially disable UI elements that require WebSocket here.
        };

        websocket.onclose = (event) => {
            console.log("WebSocket connection closed:", event.code, event.reason);
            criarNotificacao("Disconnected from signaling server. Please refresh to reconnect.", "warning");
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            websocket = null; // Nullify websocket object
            // Consider UI updates, e.g., disable buttons that need websocket.
        };
    }

    // Inicializar interface
    criarControlPanel();
    
    // Mostrar dica inicial (apenas se não for modo câmera)
    const currentUrlParams = new URLSearchParams(window.location.search); // Renamed to avoid conflict
    if (!currentUrlParams.get('mode')) {
        setTimeout(() => {
            criarNotificacao("Use as setas do teclado para mover e dar zoom! Tecla H para esconder controles.");
        }, 1000);
    }
})();
