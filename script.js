// Elementos do DOM
const form = document.getElementById('signatureForm');
const successPanel = document.getElementById('successPanel');
const signatureInfo = document.getElementById('signatureInfo');
const termsContent = document.getElementById('termsContent');
const signaturePad = document.getElementById('signaturePad');
const clearSignatureBtn = document.getElementById('clearSignature');

// Definir data atual
document.getElementById('signatureDate').valueAsDate = new Date();

// Avisar se estiver abrindo o arquivo direto (sem servidor)
const serverWarning = document.getElementById('serverWarning');
if (serverWarning && (window.location.protocol === 'file:' || !window.location.hostname)) {
    serverWarning.style.display = 'block';
}

// Canvas de assinatura - desenho tipo lápis
let isDrawing = false;
let hasSignature = false;

function initSignaturePad() {
    const ctx = signaturePad.getContext('2d');
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, signaturePad.width, signaturePad.height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getPos(e) {
        const rect = signaturePad.getBoundingClientRect();
        const scaleX = signaturePad.width / rect.width;
        const scaleY = signaturePad.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    function start(e) {
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
        e.preventDefault();
        if (!isDrawing) return;
        hasSignature = true;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function end() {
        isDrawing = false;
    }

    signaturePad.addEventListener('mousedown', start);
    signaturePad.addEventListener('mousemove', draw);
    signaturePad.addEventListener('mouseup', end);
    signaturePad.addEventListener('mouseleave', end);
    signaturePad.addEventListener('touchstart', start, { passive: false });
    signaturePad.addEventListener('touchmove', draw, { passive: false });
    signaturePad.addEventListener('touchend', end);
}

clearSignatureBtn.addEventListener('click', () => {
    const ctx = signaturePad.getContext('2d');
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, signaturePad.width, signaturePad.height);
    hasSignature = false;
});

initSignaturePad();

// Obter assinatura como base64
function getSignatureBase64() {
    return signaturePad.toDataURL('image/png');
}

// Formatar data para exibição
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Obter texto dos termos para o PDF
function getTermsForPdf() {
    const paragraphs = termsContent.querySelectorAll('p');
    return Array.from(paragraphs).map(p =>
        `<p style="font-size: 9px; margin-bottom: 8px; color: #333; page-break-inside: avoid;">${p.textContent}</p>`
    ).join('');
}

// Escapar HTML para evitar quebra
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Gerar PDF como base64
async function generatePdfBase64(signature) {
    const termsHtml = getTermsForPdf();
    const signatureImg = signature.signatureImage || '';
    const nomeEscapado = escapeHtml(signature.userName || '');

    const pdfContent = document.createElement('div');
    pdfContent.id = 'pdf-geracao-temp';
    pdfContent.style.cssText = `
        position: relative; width: 210mm; max-width: 100%; margin: 0 auto;
        font-family: Arial, sans-serif; padding: 40px;
        color: #333; font-size: 12px; line-height: 1.6;
        background: white; box-sizing: border-box;
    `;

    const dataAssinatura = new Date(signature.signatureDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dataGeracao = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const signatureBlock = signatureImg
        ? `<div style="margin-top: 16px;"><p style="font-size: 10px; margin-bottom: 4px; font-weight: bold;">Assinatura:</p><img src="${signatureImg}" style="max-width: 200px; max-height: 80px; border: 1px solid #333; display: block;" alt="Assinatura" /></div>`
        : '';

    pdfContent.innerHTML = `
        <h1 style="font-size: 16px; margin-bottom: 6px; color: #1a1a1a;">TERMO DE USO E RESPONSABILIDADE – MUSAE BOT</h1>
        <p style="color: #666; margin-bottom: 16px; font-size: 10px;">Documento de aceitação e assinatura digital</p>
        
        <div class="terms-section" style="margin-bottom: 20px;">
            ${termsHtml}
        </div>

        <div class="signature-block" style="margin-top: 24px; padding: 16px; border: 1px solid #333; background: #f9f9f9; page-break-inside: avoid;">
            <p style="font-weight: bold; font-size: 11px; margin-bottom: 12px; text-transform: uppercase;">Declaração de aceitação e dados do assinante</p>
            <p style="font-size: 9px; margin-bottom: 12px;">Declaro que li, compreendi e aceito integralmente o Termo de Uso e Responsabilidade do Musae Bot acima descrito.</p>
            
            <table style="font-size: 10px; border-collapse: collapse;">
                <tr><td style="padding: 2px 8px 2px 0; font-weight: bold; width: 60px;">Nome completo do assinante:</td><td>${nomeEscapado}</td></tr>
                <tr><td style="padding: 2px 8px 2px 0; font-weight: bold; width: 60px;">Data da assinatura:</td><td>${dataAssinatura}</td></tr>
            </table>
            ${signatureBlock}
            <p style="margin-top: 12px; font-size: 8px; color: #666;">Documento gerado eletronicamente em ${dataGeracao}</p>
        </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: fixed; top: 0; left: 0; width: 210mm; min-height: 100vh; background: white; z-index: 99998; overflow: auto;';
    wrapper.appendChild(pdfContent);

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,15,18,0.9); z-index: 99999; display: flex; align-items: center; justify-content: center;';
    overlay.innerHTML = '<div style="background: #1a1a1f; color: #e8e8ed; padding: 24px 32px; border-radius: 12px; font-size: 1rem;">Gerando PDF...</div>';
    document.body.appendChild(wrapper);
    document.body.appendChild(overlay);

    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 300));

    const opt = {
        margin: [10, 10, 10, 10],
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { before: '.signature-block' }
    };

    let blob;
    try {
        blob = await html2pdf().set(opt).from(pdfContent).outputPdf('blob');
    } finally {
        overlay.remove();
        wrapper.remove();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Submissão do formulário
form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const userName = document.getElementById('userName').value.trim();
    const acceptTerms = document.getElementById('acceptTerms').checked;
    const signatureDate = document.getElementById('signatureDate').value;

    if (!userName) {
        alert('Por favor, informe seu nome completo.');
        return;
    }

    if (!acceptTerms) {
        alert('Você precisa aceitar os termos para continuar.');
        return;
    }

    if (!hasSignature) {
        alert('Por favor, desenhe sua assinatura no campo indicado.');
        return;
    }

    const signatureImage = getSignatureBase64();

    const signature = {
        userName,
        signatureDate,
        signatureImage,
        acceptTerms: true
    };

    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    btnText.textContent = 'Salvando...';
    submitBtn.disabled = true;

    try {
        // Gerar PDF
        const pdfBase64 = await generatePdfBase64(signature);
        const fileName = `termo-musae-bot-${userName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;

        // Enviar para o servidor
        const res = await fetch('/api/save-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                pdfBase64,
                fileName,
                signature
            })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Erro ao salvar');
        }

        signatureInfo.innerHTML = `
            <strong>Assinante:</strong> ${userName}<br>
            <strong>Data:</strong> ${formatDate(signatureDate)}<br>
            <strong>Status:</strong> Documento salvo na pasta salvarpdf
        `;

        successPanel.classList.add('visible');
        form.classList.add('hidden');
        successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
        console.error('Erro:', err);
        alert('Erro ao salvar.\n\n1. Execute "npm start" na pasta do projeto\n2. Acesse http://localhost:3000 no navegador\n3. Tente novamente');
    } finally {
        btnText.textContent = 'Enviar e Salvar';
        submitBtn.disabled = false;
    }
});
