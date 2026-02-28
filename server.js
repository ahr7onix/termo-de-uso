const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Pasta onde os PDFs serão salvos
const PDF_FOLDER = path.join(__dirname, 'salvarpdf');

// Criar pasta salvarpdf se não existir
if (!fs.existsSync(PDF_FOLDER)) {
    fs.mkdirSync(PDF_FOLDER, { recursive: true });
}

// Senha do admin - ALTERE AQUI para sua senha secreta
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1112';

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.use(session({
    secret: process.env.SESSION_SECRET || 'musae-termo-secret-key',
    resave: true,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

// API: Salvar PDF (chamado quando alguém envia o formulário)
app.post('/api/save-pdf', (req, res) => {
    try {
        const { pdfBase64, fileName, signature } = req.body;

        if (!pdfBase64 || !fileName) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = path.join(PDF_FOLDER, safeFileName);

        fs.writeFileSync(filePath, pdfBuffer);

        // Salvar metadados (nome, data) em arquivo JSON para referência
        const metaPath = path.join(PDF_FOLDER, 'registro.json');
        let registros = [];
        if (fs.existsSync(metaPath)) {
            registros = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
        registros.push({
            arquivo: safeFileName,
            assinante: signature?.userName || 'N/A',
            data: signature?.signatureDate || new Date().toISOString(),
            timestamp: new Date().toISOString()
        });
        fs.writeFileSync(metaPath, JSON.stringify(registros, null, 2));

        res.json({ success: true, message: 'PDF salvo com sucesso' });
    } catch (err) {
        console.error('Erro ao salvar PDF:', err);
        res.status(500).json({ error: 'Erro ao salvar PDF' });
    }
});

// Middleware: verificar se está logado como admin
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin.html');
}

// API: Login admin
app.post('/api/admin/login', (req, res) => {
    const password = (req.body?.password || '').trim();
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.save((err) => {
            if (err) console.error('Erro ao salvar sessão:', err);
            res.json({ success: true });
        });
    } else {
        res.json({ success: false, error: 'Senha incorreta' });
    }
});

// API: Logout admin
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// API: Listar PDFs (apenas admin)
app.get('/api/pdfs', requireAdmin, (req, res) => {
    try {
        const files = fs.readdirSync(PDF_FOLDER)
            .filter(f => f.endsWith('.pdf'))
            .map(f => {
                const stat = fs.statSync(path.join(PDF_FOLDER, f));
                return {
                    nome: f,
                    tamanho: stat.size,
                    data: stat.mtime
                };
            })
            .sort((a, b) => new Date(b.data) - new Date(a.data));

        let registros = [];
        const metaPath = path.join(PDF_FOLDER, 'registro.json');
        if (fs.existsSync(metaPath)) {
            registros = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }

        res.json({ files, registros });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar PDFs' });
    }
});

// API: Baixar PDF (apenas admin)
app.get('/api/pdf/:fileName', requireAdmin, (req, res) => {
    const fileName = req.params.fileName.replace(/\.\./g, '');
    const filePath = path.join(PDF_FOLDER, fileName);

    if (!fs.existsSync(filePath) || !fileName.endsWith('.pdf')) {
        return res.status(404).send('Arquivo não encontrado');
    }

    res.download(filePath, fileName);
});

app.listen(PORT, '0.0.0.0', () => {
    const url = process.env.RAILWAY_STATIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Pasta de PDFs: ${PDF_FOLDER}`);
    console.log(`Acesso admin: ${url}/admin.html`);
});
